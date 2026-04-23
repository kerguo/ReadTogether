package v1

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"path"
	"strings"
	"time"

	"github.com/zeromicro/go-zero/rest/httpx"

	"readtogether-api/internal/logic"
	"readtogether-api/internal/model"
	"readtogether-api/internal/svc"
	"readtogether-api/internal/types"
)

type APIGroup struct {
	ctx *svc.ServiceContext
}

func NewAPIGroup(ctx *svc.ServiceContext) *APIGroup {
	return &APIGroup{ctx: ctx}
}

// GET /api/dashboard
func (a *APIGroup) Dashboard(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	mdl := a.ctx.Model

	profiles, err := mdl.ListProfiles(ctx)
	if err != nil {
		a.internalError(ctx, w, err)
		return
	}

	userProfile, err := mdl.GetSelfProfile(ctx)
	if err != nil {
		a.internalError(ctx, w, err)
		return
	}

	groups, err := mdl.ListGroups(ctx)
	if err != nil {
		a.internalError(ctx, w, err)
		return
	}

	// collect active document ids
	docIDSet := make(map[string]struct{})
	for _, g := range groups {
		if g.ActiveDocument != "" {
			docIDSet[g.ActiveDocument] = struct{}{}
		}
	}

	docIDs := make([]string, 0, len(docIDSet))
	for id := range docIDSet {
		docIDs = append(docIDs, id)
	}

	documents := map[string]model.Document{}
	if len(docIDs) > 0 {
		documents, err = mdl.GetDocumentsByIDs(ctx, docIDs)
		if err != nil {
			a.internalError(ctx, w, err)
			return
		}
	}

	rawDiscussions, err := mdl.ListDiscussions(ctx)
	if err != nil {
		a.internalError(ctx, w, err)
		return
	}

	recs, err := mdl.ListRecommendations(ctx)
	if err != nil {
		a.internalError(ctx, w, err)
		return
	}

	typedGroups := logic.ConvertGroups(groups)
	typedDocuments := logic.ConvertDocuments(documents, profiles, a.ctx.Config.Supabase.Url, a.ctx.StorageBucket)
	typedDiscussions := logic.ConvertDiscussions(rawDiscussions, profiles)

	typedRecs := make([]types.Recommendation, len(recs))
	for i, rec := range recs {
		typedRecs[i] = types.Recommendation{
			ID:          rec.ID,
			Title:       rec.Title,
			Description: rec.Description,
		}
	}

	resp := types.DashboardResponse{
		User:            logic.ConvertProfile(userProfile),
		Groups:          typedGroups,
		Documents:       typedDocuments,
		Discussions:     typedDiscussions,
		Recommendations: typedRecs,
	}

	httpx.OkJsonCtx(ctx, w, resp)
}

// GET /api/groups/:id
func (a *APIGroup) GetGroup(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	groupID, ok := extractPathParam(r.URL.Path, "/api/groups/")
	if !ok {
		a.notFound(ctx, w)
		return
	}

	group, err := a.ctx.Model.GetGroupByID(ctx, groupID)
	if err != nil {
		a.internalError(ctx, w, err)
		return
	}
	if group == nil {
		a.notFound(ctx, w)
		return
	}

	resp := types.GroupResponse{Group: logic.ConvertGroup(*group)}
	httpx.OkJsonCtx(ctx, w, resp)
}

// GET /api/documents/:id
func (a *APIGroup) GetDocument(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	documentID, ok := extractPathParam(r.URL.Path, "/api/documents/")
	if !ok {
		a.notFound(ctx, w)
		return
	}

	doc, err := a.ctx.Model.GetDocumentByID(ctx, documentID)
	if err != nil {
		a.internalError(ctx, w, err)
		return
	}
	if doc == nil {
		a.notFound(ctx, w)
		return
	}

	profiles, err := a.ctx.Model.ListProfiles(ctx)
	if err != nil {
		a.internalError(ctx, w, err)
		return
	}

	typed := logic.ConvertDocument(*doc, profiles, a.ctx.Config.Supabase.Url, a.ctx.StorageBucket)
	httpx.OkJsonCtx(ctx, w, types.DocumentResponse{Document: typed})
}

// POST /api/documents/:id/annotations
func (a *APIGroup) CreateAnnotation(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	documentID, ok := extractPathParam(r.URL.Path, "/api/documents/")
	if !ok {
		a.notFound(ctx, w)
		return
	}

	var req types.CreateAnnotationRequest
	if err := httpx.Parse(r, &req); err != nil {
		a.badRequest(ctx, w, "invalid_request", "请求体解析失败")
		return
	}

	snippet := strings.TrimSpace(req.Snippet)
	note := strings.TrimSpace(req.Note)
	if snippet == "" || note == "" {
		a.badRequest(ctx, w, "invalid_request", "snippet 与 note 均不能为空")
		return
	}

	var authorPtr *string
	if trimmed := strings.TrimSpace(req.AuthorID); trimmed != "" {
		authorPtr = &trimmed
	}

	annotation, err := a.ctx.Model.CreateAnnotation(ctx, documentID, authorPtr, snippet, note)
	if err != nil {
		a.internalError(ctx, w, err)
		return
	}

	profiles, err := a.ctx.Model.ListProfiles(ctx)
	if err != nil {
		a.internalError(ctx, w, err)
		return
	}

	httpx.OkJsonCtx(ctx, w, logic.ConvertAnnotation(*annotation, profiles))
}

// POST /api/documents/:id/chat
func (a *APIGroup) CreateChatMessage(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	documentID, ok := extractPathParam(r.URL.Path, "/api/documents/")
	if !ok {
		a.notFound(ctx, w)
		return
	}

	var req types.CreateChatMessageRequest
	if err := httpx.Parse(r, &req); err != nil {
		a.badRequest(ctx, w, "invalid_request", "请求体解析失败")
		return
	}

	content := strings.TrimSpace(req.Content)
	if content == "" {
		a.badRequest(ctx, w, "invalid_request", "消息内容不能为空")
		return
	}

	var authorPtr *string
	if trimmed := strings.TrimSpace(req.AuthorID); trimmed != "" {
		authorPtr = &trimmed
	}

	message, err := a.ctx.Model.CreateChatMessage(ctx, documentID, authorPtr, content, req.IsSystem)
	if err != nil {
		a.internalError(ctx, w, err)
		return
	}

	profiles, err := a.ctx.Model.ListProfiles(ctx)
	if err != nil {
		a.internalError(ctx, w, err)
		return
	}

	httpx.OkJsonCtx(ctx, w, logic.ConvertChatMessage(*message, profiles))
}

// GET /api/discussions
func (a *APIGroup) ListDiscussions(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	discussions, err := a.ctx.Model.ListDiscussions(ctx)
	if err != nil {
		a.internalError(ctx, w, err)
		return
	}

	profiles, err := a.ctx.Model.ListProfiles(ctx)
	if err != nil {
		a.internalError(ctx, w, err)
		return
	}

	httpx.OkJsonCtx(ctx, w, types.DiscussionsResponse{
		Discussions: logic.ConvertDiscussions(discussions, profiles),
	})
}

// POST /api/discussions
func (a *APIGroup) CreateDiscussion(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	var req types.CreateDiscussionRequest
	if err := httpx.Parse(r, &req); err != nil {
		a.badRequest(ctx, w, "invalid_request", "请求体解析失败")
		return
	}

	groupID := strings.TrimSpace(req.GroupID)
	title := strings.TrimSpace(req.Title)
	if groupID == "" || title == "" {
		a.badRequest(ctx, w, "invalid_request", "groupId 与 title 均不能为空")
		return
	}

	var authorPtr *string
	if trimmed := strings.TrimSpace(req.AuthorID); trimmed != "" {
		authorPtr = &trimmed
	}

	discussion, err := a.ctx.Model.CreateDiscussion(ctx, groupID, authorPtr, title)
	if err != nil {
		a.internalError(ctx, w, err)
		return
	}

	profiles, err := a.ctx.Model.ListProfiles(ctx)
	if err != nil {
		a.internalError(ctx, w, err)
		return
	}

	httpx.OkJsonCtx(ctx, w, logic.ConvertDiscussion(*discussion, profiles))
}

// POST /api/groups/:id/documents
func (a *APIGroup) UploadGroupDocument(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	groupID, ok := extractPathParam(r.URL.Path, "/api/groups/")
	if !ok {
		a.notFound(ctx, w)
		return
	}

	if _, err := a.ctx.Model.GetGroupByID(ctx, groupID); err != nil {
		a.internalError(ctx, w, err)
		return
	}

	maxBytes := a.ctx.Config.Storage.MaxUploadBytes
	if maxBytes <= 0 {
		maxBytes = 25 * 1024 * 1024
	}

	if err := r.ParseMultipartForm(maxBytes); err != nil {
		a.badRequest(ctx, w, "invalid_request", "上传表单解析失败")
		return
	}

	title := strings.TrimSpace(r.FormValue("title"))
	preview := strings.TrimSpace(r.FormValue("preview"))

	const (
		previewLimitRunes   = 12_000
		fallbackPreviewText = "文档内容已上传，稍后可在阅读器查看全文。"
	)

	file, fileHeader, err := r.FormFile("file")
	var fileBytes []byte
	var mimeType string
	var fileSize int64
	storagePath := ""
	originalFileName := ""
	switch {
	case err == nil:
		defer file.Close()
		if fileHeader != nil {
			originalFileName = strings.TrimSpace(fileHeader.Filename)
		}
		fileBytes, err = io.ReadAll(file)
		if err != nil {
			a.badRequest(ctx, w, "invalid_request", "读取上传文件失败")
			return
		}
		if fileHeader != nil {
			mimeType = fileHeader.Header.Get("Content-Type")
		}
		if mimeType == "" || mimeType == "application/octet-stream" {
			if len(fileBytes) > 0 {
				mimeType = http.DetectContentType(fileBytes)
			} else {
				mimeType = "application/octet-stream"
			}
		}
		fileSize = int64(len(fileBytes))
		sanitizedName := sanitizeFileName(originalFileName)
		storagePath = path.Join(groupID, fmt.Sprintf("%d-%s", time.Now().UnixNano(), sanitizedName))

		if err := a.uploadToSupabase(ctx, storagePath, mimeType, fileBytes); err != nil {
			a.internalError(ctx, w, err)
			return
		}
	case errors.Is(err, http.ErrMissingFile):
		// no file uploaded; allow metadata-only documents
	default:
		a.badRequest(ctx, w, "invalid_request", "获取上传文件失败")
		return
	}

	lowerMime := strings.ToLower(mimeType)

	extractedPreview := ""
	pageCount := 0
	if len(fileBytes) > 0 && strings.Contains(lowerMime, "pdf") {
		name := originalFileName
		if name == "" && fileHeader != nil {
			name = fileHeader.Filename
		}
		extractResp, err := a.requestTextExtraction(ctx, fileBytes, name, mimeType)
		if err == nil && extractResp != nil {
			extractedPreview = truncateRunes(extractResp.Text, previewLimitRunes)
			if extractResp.UsedPages > 0 {
				pageCount = extractResp.UsedPages
			} else if extractResp.PageCount > 0 {
				pageCount = extractResp.PageCount
			}
		}
	}

	previewText := truncateRunes(preview, previewLimitRunes)
	if previewText == "" {
		if extractedPreview != "" {
			previewText = extractedPreview
		} else if len(fileBytes) > 0 && isPlainTextMime(lowerMime) {
			previewText = truncateRunes(string(fileBytes), previewLimitRunes)
		} else if len(fileBytes) > 0 {
			previewText = fallbackPreviewText
		}
	}

	if previewText == "" {
		previewText = fallbackPreviewText
	}

	if title == "" {
		if originalFileName != "" {
			title = strings.TrimSpace(strings.TrimSuffix(originalFileName, path.Ext(originalFileName)))
			if title == "" {
				title = originalFileName
			}
		} else if fileHeader != nil && fileHeader.Filename != "" {
			title = fileHeader.Filename
		} else {
			title = "未命名文档"
		}
	}

	if pageCount == 0 && previewText != "" {
		runeCount := len([]rune(previewText))
		if runeCount > 0 {
			pageCount = (runeCount / 800) + 1
		}
	}

	doc := model.Document{
		GroupID:     groupID,
		Title:       title,
		Preview:     previewText,
		Pages:       sql.NullInt32{Int32: int32(pageCount), Valid: pageCount > 0},
		CurrentPage: sql.NullInt32{Int32: 1, Valid: true},
		File: func() *model.FileInfo {
			if storagePath == "" {
				return nil
			}
			displayName := originalFileName
			if displayName == "" {
				displayName = title
			}
			return &model.FileInfo{
				StoragePath: storagePath,
				FileName:    displayName,
				MimeType:    mimeType,
				SizeBytes:   fileSize,
			}
		}(),
	}

	createdDoc, err := a.ctx.Model.CreateDocument(ctx, doc)
	if err != nil {
		a.internalError(ctx, w, err)
		return
	}

	// Refresh group & document data
	_ = a.ctx.Model.SetActiveDocument(ctx, groupID, createdDoc.ID)

	fullDoc, err := a.ctx.Model.GetDocumentByID(ctx, createdDoc.ID)
	if err != nil {
		a.internalError(ctx, w, err)
		return
	}
	if fullDoc == nil {
		a.internalError(ctx, w, fmt.Errorf("document %s not found after creation", createdDoc.ID))
		return
	}

	group, err := a.ctx.Model.GetGroupByID(ctx, groupID)
	if err != nil {
		a.internalError(ctx, w, err)
		return
	}
	if group == nil {
		a.internalError(ctx, w, fmt.Errorf("group %s not found after document creation", groupID))
		return
	}

	profiles, err := a.ctx.Model.ListProfiles(ctx)
	if err != nil {
		a.internalError(ctx, w, err)
		return
	}

	resp := types.UploadDocumentResult{
		Group:    logic.ConvertGroup(*group),
		Document: logic.ConvertDocument(*fullDoc, profiles, a.ctx.Config.Supabase.Url, a.ctx.StorageBucket),
	}

	httpx.OkJsonCtx(ctx, w, resp)
}

// Helper methods -------------------------------------------------------------

type extractResponse struct {
	Text      string `json:"text"`
	PageCount int    `json:"pageCount"`
	UsedPages int    `json:"usedPages"`
}

func (a *APIGroup) uploadToSupabase(ctx context.Context, storagePath, contentType string, data []byte) error {
	base := strings.TrimSuffix(a.ctx.Config.Supabase.Url, "/")
	endpoint := fmt.Sprintf("%s/storage/v1/object/%s/%s", base, a.ctx.StorageBucket, strings.TrimPrefix(storagePath, "/"))

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(data))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", contentType)
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", a.ctx.Config.Supabase.ServiceKey))
	req.Header.Set("x-upsert", "true")

	resp, err := a.ctx.HttpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
		return fmt.Errorf("supabase upload failed: status=%d body=%s", resp.StatusCode, string(body))
	}
	return nil
}

func (a *APIGroup) requestTextExtraction(ctx context.Context, data []byte, filename, mimeType string) (*extractResponse, error) {
	base := strings.TrimSuffix(a.ctx.Config.TextService.BaseURL, "/")
	if base == "" {
		return nil, fmt.Errorf("text service base URL not configured")
	}

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	part, err := writer.CreateFormFile("file", filename)
	if err != nil {
		return nil, err
	}
	if _, err := part.Write(data); err != nil {
		return nil, err
	}
	if err := writer.Close(); err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, base+"/extract", body)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())

	resp, err := a.ctx.HttpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		payload, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
		return nil, fmt.Errorf("text extraction failed: status=%d body=%s", resp.StatusCode, string(payload))
	}

	var result extractResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	return &result, nil
}

func (a *APIGroup) badRequest(ctx context.Context, w http.ResponseWriter, code, message string) {
	httpx.WriteJsonCtx(ctx, w, http.StatusBadRequest, types.ErrorResponse{Code: code, Message: message})
}

func (a *APIGroup) notFound(ctx context.Context, w http.ResponseWriter) {
	httpx.WriteJsonCtx(ctx, w, http.StatusNotFound, types.ErrorResponse{Code: "not_found", Message: "资源不存在"})
}

func (a *APIGroup) internalError(ctx context.Context, w http.ResponseWriter, err error) {
	httpx.WriteJsonCtx(ctx, w, http.StatusInternalServerError, types.ErrorResponse{Code: "internal_error", Message: err.Error()})
}

func extractPathParam(pathValue, prefix string) (string, bool) {
	if !strings.HasPrefix(pathValue, prefix) {
		return "", false
	}
	rest := strings.TrimPrefix(pathValue, prefix)
	rest = strings.Trim(rest, "/")
	if rest == "" {
		return "", false
	}
	if idx := strings.IndexRune(rest, '/'); idx >= 0 {
		rest = rest[:idx]
	}
	return rest, true
}

func sanitizeFileName(name string) string {
	cleaned := strings.Map(func(r rune) rune {
		switch {
		case r >= 'a' && r <= 'z':
			return r
		case r >= 'A' && r <= 'Z':
			return r
		case r >= '0' && r <= '9':
			return r
		case r == '.' || r == '-' || r == '_':
			return r
		default:
			return '-'
		}
	}, name)
	cleaned = strings.Trim(cleaned, "-")
	if cleaned == "" {
		cleaned = fmt.Sprintf("file-%d", time.Now().Unix())
	}
	return cleaned
}

func truncateRunes(input string, limit int) string {
	trimmed := strings.TrimSpace(input)
	if limit <= 0 {
		return trimmed
	}
	runes := []rune(trimmed)
	if len(runes) <= limit {
		return trimmed
	}
	return string(runes[:limit])
}

func isPlainTextMime(mime string) bool {
	if mime == "" {
		return false
	}
	lower := strings.ToLower(mime)
	if strings.HasPrefix(lower, "text/") {
		return true
	}
	switch {
	case strings.Contains(lower, "json"):
		return true
	case strings.Contains(lower, "markdown"):
		return true
	case strings.Contains(lower, "html"):
		return true
	case strings.Contains(lower, "xml"):
		return true
	default:
		return false
	}
}
