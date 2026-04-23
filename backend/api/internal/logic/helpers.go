package logic

import (
	"fmt"
	"strings"
	"time"

	"readtogether-api/internal/model"
	"readtogether-api/internal/types"
)

func formatTime(t time.Time) string {
	if t.IsZero() {
		return ""
	}
	return t.UTC().Format(time.RFC3339)
}

func buildPublicURL(baseURL, bucket, storagePath string) string {
	if storagePath == "" {
		return ""
	}
	trimmed := strings.TrimPrefix(storagePath, "/")
	base := strings.TrimSuffix(baseURL, "/")
	return fmt.Sprintf("%s/storage/v1/object/public/%s/%s", base, bucket, trimmed)
}

func groupMemberToType(member model.GroupMember) types.GroupMember {
	return types.GroupMember{
		ID:       member.ID,
		Name:     member.Name,
		Role:     member.Role,
		Progress: member.Progress,
	}
}

func documentListToType(item model.DocumentListItem) types.DocumentListItem {
	return types.DocumentListItem{
		ID:        item.ID,
		Title:     item.Title,
		UpdatedAt: formatTime(item.UpdatedAt),
	}
}

func annotationToType(annotation model.Annotation, profiles map[string]model.Profile) types.Annotation {
	user := "匿名成员"
	if annotation.AuthorID.Valid {
		if profile, ok := profiles[annotation.AuthorID.String]; ok {
			user = profile.Name
		}
	}
	return types.Annotation{
		ID:      annotation.ID,
		User:    user,
		Snippet: annotation.Snippet,
		Note:    annotation.Note,
		Created: formatTime(annotation.CreatedAt),
	}
}

func chatMessageToType(message model.ChatMessage, profiles map[string]model.Profile) types.ChatMessage {
	user := "系统提示"
	if !message.IsSystem {
		user = "匿名成员"
		if message.AuthorID.Valid {
			if profile, ok := profiles[message.AuthorID.String]; ok {
				user = profile.Name
			}
		}
	}
	formatted := formatTime(message.CreatedAt)
	return types.ChatMessage{
		ID:        message.ID,
		User:      user,
		Content:   message.Content,
		IsSystem:  message.IsSystem,
		Time:      formatted,
		CreatedAt: formatted,
	}
}

func documentToType(doc model.Document, profiles map[string]model.Profile, supabaseURL, bucket string) types.Document {
	host := doc.HostName
	if host == "" && doc.HostProfile.Valid {
		if profile, ok := profiles[doc.HostProfile.String]; ok {
			host = profile.Name
		}
	}
	pages := 0
	if doc.Pages.Valid {
		pages = int(doc.Pages.Int32)
	}
	currentPage := 0
	if doc.CurrentPage.Valid {
		currentPage = int(doc.CurrentPage.Int32)
	}

	annotations := make([]types.Annotation, len(doc.Annotations))
	for i, ann := range doc.Annotations {
		annotations[i] = annotationToType(ann, profiles)
	}

	chat := make([]types.ChatMessage, len(doc.Chat))
	for i, msg := range doc.Chat {
		chat[i] = chatMessageToType(msg, profiles)
	}

	var file *types.FileInfo
	if doc.File != nil {
		file = &types.FileInfo{
			Name:      doc.File.FileName,
			Type:      doc.File.MimeType,
			SizeBytes: doc.File.SizeBytes,
			URL:       buildPublicURL(supabaseURL, bucket, doc.File.StoragePath),
		}
	}

	return types.Document{
		ID:          doc.ID,
		GroupID:     doc.GroupID,
		Title:       doc.Title,
		Preview:     doc.Preview,
		Pages:       pages,
		CurrentPage: currentPage,
		Host:        host,
		File:        file,
		Annotations: annotations,
		Chat:        chat,
		UpdatedAt:   formatTime(doc.UpdatedAt),
	}
}

func groupToType(group model.Group) types.Group {
	members := make([]types.GroupMember, len(group.Members))
	for i, member := range group.Members {
		members[i] = groupMemberToType(member)
	}
	documents := make([]types.DocumentListItem, len(group.Documents))
	for i, doc := range group.Documents {
		documents[i] = documentListToType(doc)
	}

	return types.Group{
		ID:             group.ID,
		Name:           group.Name,
		Description:    group.Description,
		NextSession:    group.NextSession,
		ActiveDocument: group.ActiveDocument,
		Members:        members,
		Documents:      documents,
	}
}

func discussionToType(d model.Discussion, profiles map[string]model.Profile) types.DiscussionThread {
	author := "匿名成员"
	if d.AuthorID.Valid {
		if profile, ok := profiles[d.AuthorID.String]; ok {
			author = profile.Name
		}
	}
	lastReply := ""
	if d.LastReply.Valid {
		lastReply = formatTime(d.LastReply.Time)
	}
	return types.DiscussionThread{
		ID:        d.ID,
		GroupID:   d.GroupID,
		Title:     d.Title,
		Author:    author,
		Replies:   d.Replies,
		LastReply: lastReply,
	}
}

func profileToType(p *model.Profile) *types.Profile {
	if p == nil {
		return nil
	}
	return &types.Profile{
		ID:          p.ID,
		Name:        p.Name,
		AvatarColor: p.AvatarColor,
		Timezone:    p.Timezone,
	}
}

// Exported helpers -----------------------------------------------------------

func ConvertAnnotation(annotation model.Annotation, profiles map[string]model.Profile) types.Annotation {
	return annotationToType(annotation, profiles)
}

func ConvertAnnotations(items []model.Annotation, profiles map[string]model.Profile) []types.Annotation {
	result := make([]types.Annotation, len(items))
	for i, ann := range items {
		result[i] = annotationToType(ann, profiles)
	}
	return result
}

func ConvertChatMessage(message model.ChatMessage, profiles map[string]model.Profile) types.ChatMessage {
	return chatMessageToType(message, profiles)
}

func ConvertChatMessages(items []model.ChatMessage, profiles map[string]model.Profile) []types.ChatMessage {
	result := make([]types.ChatMessage, len(items))
	for i, msg := range items {
		result[i] = chatMessageToType(msg, profiles)
	}
	return result
}

func ConvertDocument(doc model.Document, profiles map[string]model.Profile, supabaseURL, bucket string) types.Document {
	return documentToType(doc, profiles, supabaseURL, bucket)
}

func ConvertDocuments(docs map[string]model.Document, profiles map[string]model.Profile, supabaseURL, bucket string) map[string]types.Document {
	result := make(map[string]types.Document, len(docs))
	for id, doc := range docs {
		result[id] = documentToType(doc, profiles, supabaseURL, bucket)
	}
	return result
}

func ConvertGroup(group model.Group) types.Group {
	return groupToType(group)
}

func ConvertGroups(groups []model.Group) []types.Group {
	result := make([]types.Group, len(groups))
	for i, group := range groups {
		result[i] = groupToType(group)
	}
	return result
}

func ConvertDiscussion(d model.Discussion, profiles map[string]model.Profile) types.DiscussionThread {
	return discussionToType(d, profiles)
}

func ConvertDiscussions(items []model.Discussion, profiles map[string]model.Profile) []types.DiscussionThread {
	result := make([]types.DiscussionThread, len(items))
	for i, disc := range items {
		result[i] = discussionToType(disc, profiles)
	}
	return result
}

func ConvertProfile(p *model.Profile) *types.Profile {
	return profileToType(p)
}

func FormatTime(t time.Time) string {
	return formatTime(t)
}

func BuildPublicURL(baseURL, bucket, storagePath string) string {
	return buildPublicURL(baseURL, bucket, storagePath)
}
