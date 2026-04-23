package types

type ErrorResponse struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

type Profile struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	AvatarColor string `json:"avatarColor"`
	Timezone    string `json:"timezone,omitempty"`
}

type GroupMember struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Role     string `json:"role,omitempty"`
	Progress string `json:"progress,omitempty"`
}

type DocumentListItem struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	UpdatedAt string `json:"updatedAt"`
}

type Group struct {
	ID             string             `json:"id"`
	Name           string             `json:"name"`
	Description    string             `json:"description,omitempty"`
	NextSession    string             `json:"nextSession,omitempty"`
	ActiveDocument string             `json:"activeDocumentId,omitempty"`
	Members        []GroupMember      `json:"members"`
	Documents      []DocumentListItem `json:"documents"`
}

type FileInfo struct {
	URL       string `json:"url"`
	Name      string `json:"name"`
	Type      string `json:"type"`
	SizeBytes int64  `json:"size"`
}

type Annotation struct {
	ID      string `json:"id"`
	User    string `json:"user"`
	Snippet string `json:"snippet"`
	Note    string `json:"note"`
	Created string `json:"createdAt"`
}

type ChatMessage struct {
	ID        string `json:"id"`
	User      string `json:"user"`
	Content   string `json:"content"`
	IsSystem  bool   `json:"isSystem"`
	Time      string `json:"time"`
	CreatedAt string `json:"createdAt"`
}

type Document struct {
	ID          string        `json:"id"`
	GroupID     string        `json:"groupId"`
	Title       string        `json:"title"`
	Preview     string        `json:"preview"`
	Pages       int           `json:"pages"`
	CurrentPage int           `json:"currentPage"`
	Host        string        `json:"host"`
	File        *FileInfo     `json:"file,omitempty"`
	Annotations []Annotation  `json:"annotations"`
	Chat        []ChatMessage `json:"chat"`
	UpdatedAt   string        `json:"updatedAt"`
}

type Recommendation struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	Description string `json:"description"`
}

type DashboardResponse struct {
	User            *Profile            `json:"user"`
	Groups          []Group             `json:"groups"`
	Documents       map[string]Document `json:"documents"`
	Discussions     []DiscussionThread  `json:"discussions"`
	Recommendations []Recommendation    `json:"recommendations"`
}

type GroupResponse struct {
	Group Group `json:"group"`
}

type DocumentResponse struct {
	Document Document `json:"document"`
}

type DiscussionThread struct {
	ID        string `json:"id"`
	GroupID   string `json:"groupId"`
	Title     string `json:"title"`
	Author    string `json:"author"`
	Replies   int    `json:"replies"`
	LastReply string `json:"lastReply"`
}

type DiscussionsResponse struct {
	Discussions []DiscussionThread `json:"discussions"`
}

type CreateAnnotationRequest struct {
	Snippet  string `json:"snippet"`
	Note     string `json:"note"`
	AuthorID string `json:"authorId,omitempty"`
}

type CreateChatMessageRequest struct {
	Content  string `json:"content"`
	AuthorID string `json:"authorId,omitempty"`
	IsSystem bool   `json:"isSystem,omitempty"`
}

type CreateDiscussionRequest struct {
	GroupID  string `json:"groupId"`
	Title    string `json:"title"`
	AuthorID string `json:"authorId,omitempty"`
}

type UploadDocumentResult struct {
	Group    Group    `json:"group"`
	Document Document `json:"document"`
}
