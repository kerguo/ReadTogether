package model

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Model struct {
	db *pgxpool.Pool
}

type Profile struct {
	ID          string
	Name        string
	AvatarColor string
	Timezone    string
	IsSelf      bool
}

type GroupMember struct {
	ID       string
	Name     string
	Role     string
	Progress string
}

type DocumentListItem struct {
	ID        string
	Title     string
	UpdatedAt time.Time
}

type Group struct {
	ID             string
	Name           string
	Description    string
	NextSession    string
	ActiveDocument string
	Members        []GroupMember
	Documents      []DocumentListItem
}

type FileInfo struct {
	StoragePath string
	FileName    string
	MimeType    string
	SizeBytes   int64
}

type Annotation struct {
	ID         string
	DocumentID string
	AuthorID   sql.NullString
	Snippet    string
	Note       string
	CreatedAt  time.Time
}

type ChatMessage struct {
	ID         string
	DocumentID string
	AuthorID   sql.NullString
	Content    string
	IsSystem   bool
	CreatedAt  time.Time
}

type Document struct {
	ID          string
	GroupID     string
	Title       string
	Preview     string
	Pages       sql.NullInt32
	CurrentPage sql.NullInt32
	HostProfile sql.NullString
	HostName    string
	File        *FileInfo
	Annotations []Annotation
	Chat        []ChatMessage
	UpdatedAt   time.Time
}

type Discussion struct {
	ID        string
	GroupID   string
	AuthorID  sql.NullString
	Title     string
	Replies   int
	LastReply sql.NullTime
	CreatedAt time.Time
}

type Recommendation struct {
	ID          string
	Title       string
	Description string
}

type DashboardData struct {
	User            *Profile
	Groups          []Group
	Documents       map[string]Document
	Discussions     []Discussion
	Recommendations []Recommendation
}

func NewModel(db *pgxpool.Pool) *Model {
	return &Model{db: db}
}

func (m *Model) GetSelfProfile(ctx context.Context) (*Profile, error) {
	const query = `SELECT id, name, COALESCE(avatar_color, ''), COALESCE(timezone, ''), is_self FROM profiles WHERE is_self = true LIMIT 1`
	row := m.db.QueryRow(ctx, query)

	var profile Profile
	if err := row.Scan(&profile.ID, &profile.Name, &profile.AvatarColor, &profile.Timezone, &profile.IsSelf); err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("query self profile: %w", err)
	}
	return &profile, nil
}

func (m *Model) ListProfiles(ctx context.Context) (map[string]Profile, error) {
	const query = `SELECT id, name, COALESCE(avatar_color, ''), COALESCE(timezone, ''), is_self FROM profiles`

	rows, err := m.db.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("list profiles: %w", err)
	}
	defer rows.Close()

	profiles := make(map[string]Profile)
	for rows.Next() {
		var p Profile
		if err := rows.Scan(&p.ID, &p.Name, &p.AvatarColor, &p.Timezone, &p.IsSelf); err != nil {
			return nil, fmt.Errorf("scan profile: %w", err)
		}
		profiles[p.ID] = p
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate profiles: %w", err)
	}
	return profiles, nil
}

func (m *Model) ListGroups(ctx context.Context) ([]Group, error) {
	const query = `SELECT id, name, COALESCE(description, ''), COALESCE(next_session, ''), COALESCE(active_document_id, '') FROM groups ORDER BY created_at DESC`
	rows, err := m.db.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("list groups: %w", err)
	}
	defer rows.Close()

	groups := make([]Group, 0)
	for rows.Next() {
		var g Group
		if err := rows.Scan(&g.ID, &g.Name, &g.Description, &g.NextSession, &g.ActiveDocument); err != nil {
			return nil, fmt.Errorf("scan group: %w", err)
		}
		groups = append(groups, g)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate groups: %w", err)
	}

	if len(groups) == 0 {
		return groups, nil
	}

	groupIDs := make([]string, len(groups))
	for i, g := range groups {
		groupIDs[i] = g.ID
	}

	membersByGroup, err := m.listGroupMembers(ctx, groupIDs)
	if err != nil {
		return nil, err
	}

	docsByGroup, err := m.listGroupDocuments(ctx, groupIDs)
	if err != nil {
		return nil, err
	}

	for i, g := range groups {
		groups[i].Members = membersByGroup[g.ID]
		groups[i].Documents = docsByGroup[g.ID]
	}
	return groups, nil
}

func (m *Model) listGroupMembers(ctx context.Context, groupIDs []string) (map[string][]GroupMember, error) {
	if len(groupIDs) == 0 {
		return map[string][]GroupMember{}, nil
	}

	const query = `SELECT gm.group_id, p.id, p.name, COALESCE(gm.role, ''), COALESCE(gm.progress, '')
        FROM group_members gm
        JOIN profiles p ON p.id = gm.profile_id
        WHERE gm.group_id = ANY($1)
        ORDER BY gm.group_id, p.name`

	rows, err := m.db.Query(ctx, query, groupIDs)
	if err != nil {
		return nil, fmt.Errorf("list group members: %w", err)
	}
	defer rows.Close()

	result := make(map[string][]GroupMember)
	for rows.Next() {
		var groupID string
		var member GroupMember
		if err := rows.Scan(&groupID, &member.ID, &member.Name, &member.Role, &member.Progress); err != nil {
			return nil, fmt.Errorf("scan group member: %w", err)
		}
		result[groupID] = append(result[groupID], member)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate group members: %w", err)
	}
	return result, nil
}

func (m *Model) listGroupDocuments(ctx context.Context, groupIDs []string) (map[string][]DocumentListItem, error) {
	if len(groupIDs) == 0 {
		return map[string][]DocumentListItem{}, nil
	}

	const query = `SELECT id, group_id, title, updated_at FROM documents WHERE group_id = ANY($1) ORDER BY updated_at DESC`
	rows, err := m.db.Query(ctx, query, groupIDs)
	if err != nil {
		return nil, fmt.Errorf("list group documents: %w", err)
	}
	defer rows.Close()

	result := make(map[string][]DocumentListItem)
	for rows.Next() {
		var item DocumentListItem
		var groupID string
		if err := rows.Scan(&item.ID, &groupID, &item.Title, &item.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan group document: %w", err)
		}
		result[groupID] = append(result[groupID], item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate group documents: %w", err)
	}
	return result, nil
}

func (m *Model) GetDocumentsByIDs(ctx context.Context, documents []string) (map[string]Document, error) {
	if len(documents) == 0 {
		return map[string]Document{}, nil
	}

	const query = `SELECT d.id, d.group_id, d.title, COALESCE(d.preview, ''), COALESCE(d.page_count, 0),
        COALESCE(d.current_page, 0), COALESCE(d.host_profile_id::text, ''), COALESCE(p.name, ''),
        COALESCE(d.storage_path, ''), COALESCE(d.file_name, ''), COALESCE(d.mime_type, ''), COALESCE(d.size_bytes, 0),
        d.updated_at
        FROM documents d
        LEFT JOIN profiles p ON p.id = d.host_profile_id
        WHERE d.id = ANY($1)`

	rows, err := m.db.Query(ctx, query, documents)
	if err != nil {
		return nil, fmt.Errorf("query documents: %w", err)
	}
	defer rows.Close()

	docs := make(map[string]Document)
	docIDs := make([]string, 0, len(documents))
	for rows.Next() {
		var doc Document
		var hostProfile sql.NullString
		var storagePath, fileName, mimeType sql.NullString
		var sizeBytes sql.NullInt64
		if err := rows.Scan(&doc.ID, &doc.GroupID, &doc.Title, &doc.Preview, &doc.Pages, &doc.CurrentPage, &hostProfile, &doc.HostName,
			&storagePath, &fileName, &mimeType, &sizeBytes, &doc.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan document: %w", err)
		}
		doc.HostProfile = hostProfile
		if storagePath.Valid || fileName.Valid || mimeType.Valid || sizeBytes.Valid {
			doc.File = &FileInfo{
				StoragePath: storagePath.String,
				FileName:    fileName.String,
				MimeType:    mimeType.String,
				SizeBytes:   0,
			}
			if sizeBytes.Valid {
				doc.File.SizeBytes = sizeBytes.Int64
			}
		}
		docs[doc.ID] = doc
		docIDs = append(docIDs, doc.ID)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate documents: %w", err)
	}

	if len(docIDs) == 0 {
		return docs, nil
	}

	annotations, err := m.listAnnotations(ctx, docIDs)
	if err != nil {
		return nil, err
	}
	chats, err := m.listChatMessages(ctx, docIDs)
	if err != nil {
		return nil, err
	}

	for id := range docs {
		doc := docs[id]
		doc.Annotations = annotations[id]
		doc.Chat = chats[id]
		docs[id] = doc
	}

	return docs, nil
}

func (m *Model) listAnnotations(ctx context.Context, docIDs []string) (map[string][]Annotation, error) {
	const query = `SELECT id, document_id, author_id, snippet, note, created_at FROM document_annotations WHERE document_id = ANY($1) ORDER BY created_at`
	rows, err := m.db.Query(ctx, query, docIDs)
	if err != nil {
		return nil, fmt.Errorf("list annotations: %w", err)
	}
	defer rows.Close()

	result := make(map[string][]Annotation)
	for rows.Next() {
		var ann Annotation
		if err := rows.Scan(&ann.ID, &ann.DocumentID, &ann.AuthorID, &ann.Snippet, &ann.Note, &ann.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan annotation: %w", err)
		}
		result[ann.DocumentID] = append(result[ann.DocumentID], ann)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate annotations: %w", err)
	}
	return result, nil
}

func (m *Model) listChatMessages(ctx context.Context, docIDs []string) (map[string][]ChatMessage, error) {
	const query = `SELECT id, document_id, author_id, content, is_system, created_at FROM document_chat_messages WHERE document_id = ANY($1) ORDER BY created_at`
	rows, err := m.db.Query(ctx, query, docIDs)
	if err != nil {
		return nil, fmt.Errorf("list chat messages: %w", err)
	}
	defer rows.Close()

	result := make(map[string][]ChatMessage)
	for rows.Next() {
		var msg ChatMessage
		if err := rows.Scan(&msg.ID, &msg.DocumentID, &msg.AuthorID, &msg.Content, &msg.IsSystem, &msg.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan chat message: %w", err)
		}
		result[msg.DocumentID] = append(result[msg.DocumentID], msg)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate chat messages: %w", err)
	}
	return result, nil
}

func (m *Model) ListDiscussions(ctx context.Context) ([]Discussion, error) {
	const query = `SELECT id, group_id, author_id, title, COALESCE(replies, 0), last_reply, created_at FROM discussions ORDER BY created_at DESC`
	rows, err := m.db.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("list discussions: %w", err)
	}
	defer rows.Close()

	var result []Discussion
	for rows.Next() {
		var disc Discussion
		if err := rows.Scan(&disc.ID, &disc.GroupID, &disc.AuthorID, &disc.Title, &disc.Replies, &disc.LastReply, &disc.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan discussion: %w", err)
		}
		result = append(result, disc)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate discussions: %w", err)
	}
	return result, nil
}

func (m *Model) ListRecommendations(ctx context.Context) ([]Recommendation, error) {
	const query = `SELECT id, title, COALESCE(description, '') FROM recommendations ORDER BY created_at DESC`
	rows, err := m.db.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("list recommendations: %w", err)
	}
	defer rows.Close()

	var result []Recommendation
	for rows.Next() {
		var rec Recommendation
		if err := rows.Scan(&rec.ID, &rec.Title, &rec.Description); err != nil {
			return nil, fmt.Errorf("scan recommendation: %w", err)
		}
		result = append(result, rec)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate recommendations: %w", err)
	}
	return result, nil
}

func (m *Model) GetGroupByID(ctx context.Context, groupID string) (*Group, error) {
	const query = `SELECT id, name, COALESCE(description, ''), COALESCE(next_session, ''), COALESCE(active_document_id, '') FROM groups WHERE id = $1`
	row := m.db.QueryRow(ctx, query, groupID)

	var g Group
	if err := row.Scan(&g.ID, &g.Name, &g.Description, &g.NextSession, &g.ActiveDocument); err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("get group: %w", err)
	}

	members, err := m.listGroupMembers(ctx, []string{groupID})
	if err != nil {
		return nil, err
	}
	documents, err := m.listGroupDocuments(ctx, []string{groupID})
	if err != nil {
		return nil, err
	}
	g.Members = members[groupID]
	g.Documents = documents[groupID]
	return &g, nil
}

func (m *Model) GetDocumentByID(ctx context.Context, documentID string) (*Document, error) {
	docs, err := m.GetDocumentsByIDs(ctx, []string{documentID})
	if err != nil {
		return nil, err
	}
	doc, ok := docs[documentID]
	if !ok {
		return nil, nil
	}
	return &doc, nil
}

func (m *Model) CreateAnnotation(ctx context.Context, documentID string, authorID *string, snippet, note string) (*Annotation, error) {
	const query = `INSERT INTO document_annotations (document_id, author_id, snippet, note)
        VALUES ($1, NULLIF($2, ''), $3, $4)
        RETURNING id, document_id, author_id, snippet, note, created_at`

	var ann Annotation
	var author sql.NullString
	authorString := nullableArg(authorID)
	if err := m.db.QueryRow(ctx, query, documentID, authorString, snippet, note).Scan(&ann.ID, &ann.DocumentID, &author, &ann.Snippet, &ann.Note, &ann.CreatedAt); err != nil {
		return nil, fmt.Errorf("create annotation: %w", err)
	}
	ann.AuthorID = author
	return &ann, nil
}

func (m *Model) CreateChatMessage(ctx context.Context, documentID string, authorID *string, content string, isSystem bool) (*ChatMessage, error) {
	const query = `INSERT INTO document_chat_messages (document_id, author_id, content, is_system)
        VALUES ($1, NULLIF($2, ''), $3, $4)
        RETURNING id, document_id, author_id, content, is_system, created_at`

	var msg ChatMessage
	var author sql.NullString
	if err := m.db.QueryRow(ctx, query, documentID, nullableArg(authorID), content, isSystem).Scan(&msg.ID, &msg.DocumentID, &author, &msg.Content, &msg.IsSystem, &msg.CreatedAt); err != nil {
		return nil, fmt.Errorf("create chat message: %w", err)
	}
	msg.AuthorID = author
	return &msg, nil
}

func (m *Model) CreateDiscussion(ctx context.Context, groupID string, authorID *string, title string) (*Discussion, error) {
	const query = `INSERT INTO discussions (group_id, author_id, title, replies, created_at)
        VALUES ($1, NULLIF($2, ''), $3, 0, NOW())
        RETURNING id, group_id, author_id, title, replies, last_reply, created_at`

	var disc Discussion
	var author sql.NullString
	if err := m.db.QueryRow(ctx, query, groupID, nullableArg(authorID), title).Scan(&disc.ID, &disc.GroupID, &author, &disc.Title, &disc.Replies, &disc.LastReply, &disc.CreatedAt); err != nil {
		return nil, fmt.Errorf("create discussion: %w", err)
	}
	disc.AuthorID = author
	return &disc, nil
}

func (m *Model) CreateDocument(ctx context.Context, doc Document) (*Document, error) {
	const query = `INSERT INTO documents (group_id, title, preview, page_count, current_page, host_profile_id, storage_path, file_name, mime_type, size_bytes)
        VALUES ($1, $2, $3, NULLIF($4, 0), NULLIF($5, 0), NULLIF($6::uuid, NULL), NULLIF($7, ''), NULLIF($8, ''), NULLIF($9, ''), NULLIF($10, 0))
        RETURNING id, updated_at`

	var newID string
	var updatedAt time.Time
	hostID := ""
	if doc.HostProfile.Valid {
		hostID = doc.HostProfile.String
	}
	storagePath := ""
	fileName := ""
	mimeType := ""
	sizeBytes := int64(0)
	if doc.File != nil {
		storagePath = doc.File.StoragePath
		fileName = doc.File.FileName
		mimeType = doc.File.MimeType
		sizeBytes = doc.File.SizeBytes
	}
	pageCount := int32(0)
	if doc.Pages.Valid {
		pageCount = doc.Pages.Int32
	}
	currentPage := int32(0)
	if doc.CurrentPage.Valid {
		currentPage = doc.CurrentPage.Int32
	}

	if err := m.db.QueryRow(ctx, query, doc.GroupID, doc.Title, doc.Preview, pageCount, currentPage, hostID, storagePath, fileName, mimeType, sizeBytes).Scan(&newID, &updatedAt); err != nil {
		return nil, fmt.Errorf("create document: %w", err)
	}

	createdDoc := doc
	createdDoc.ID = newID
	createdDoc.UpdatedAt = updatedAt
	return &createdDoc, nil
}

func (m *Model) SetActiveDocument(ctx context.Context, groupID, documentID string) error {
	const query = `UPDATE groups SET active_document_id = $2 WHERE id = $1`
	if _, err := m.db.Exec(ctx, query, groupID, documentID); err != nil {
		return fmt.Errorf("set active document: %w", err)
	}
	return nil
}

func (m *Model) nullableProfileName(authorID sql.NullString, profiles map[string]Profile) string {
	if !authorID.Valid {
		return ""
	}
	if profiles == nil {
		return ""
	}
	if profile, ok := profiles[authorID.String]; ok {
		return profile.Name
	}
	return ""
}

func nullableArg(value *string) any {
	if value == nil {
		return ""
	}
	return strings.TrimSpace(*value)
}
