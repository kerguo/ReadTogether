package logic

import (
	"bytes"
	"context"
	"fmt"
	"strings"
	"time"

	pdf "github.com/ledongthuc/pdf"
	"github.com/zeromicro/go-zero/core/logx"

	"readtogether-textservice/internal/svc"
	"readtogether-textservice/internal/types"
)

type ExtractLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

func NewExtractLogic(ctx context.Context, svcCtx *svc.ServiceContext) *ExtractLogic {
	return &ExtractLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

// sanitizePDF trims leading bytes before %PDF- header to handle malformed files.
func sanitizePDF(data []byte) []byte {
	magic := []byte("%PDF-")
	if idx := bytes.Index(data, magic); idx > 0 {
		return data[idx:]
	}
	return data
}

// ExtractTextFromPDF reads text from the first N pages of a PDF.
func ExtractTextFromPDF(data []byte, maxPages int) (string, int, int, error) {
	data = sanitizePDF(data)
	reader, err := pdf.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return "", 0, 0, fmt.Errorf("open pdf: %w", err)
	}

	totalPages := reader.NumPage()
	if totalPages == 0 {
		return "", 0, 0, fmt.Errorf("pdf has no pages")
	}

	limit := totalPages
	if maxPages > 0 && maxPages < totalPages {
		limit = maxPages
	}

	var builder strings.Builder
	used := 0

	for pageIndex := 1; pageIndex <= limit; pageIndex++ {
		page := reader.Page(pageIndex)
		if page.V.IsNull() {
			continue
		}
		content, err := page.GetPlainText(nil)
		if err != nil {
			// Keep parsing other pages even if one fails.
			continue
		}
		text := strings.TrimSpace(content)
		if text != "" {
			builder.WriteString(text)
			builder.WriteString("\n\n")
		}
		used++
	}

	return strings.TrimSpace(builder.String()), totalPages, used, nil
}

func (l *ExtractLogic) Process(fileName string, mimeType string, fileSize int64, data []byte) (*types.ExtractResponse, error) {
	start := time.Now()
	maxPages := l.svcCtx.Config.MaxPages
	text, totalPages, usedPages, err := ExtractTextFromPDF(data, maxPages)
	if err != nil {
		return nil, err
	}

	truncated := false
	maxLen := 20000
	if len(text) > maxLen {
		text = text[:maxLen]
		truncated = true
	}

	return &types.ExtractResponse{
		FileName:   fileName,
		FileSize:   fileSize,
		MimeType:   mimeType,
		PageCount:  totalPages,
		UsedPages:  usedPages,
		Text:       text,
		Truncated:  truncated,
		DurationMs: time.Since(start).Milliseconds(),
	}, nil
}
