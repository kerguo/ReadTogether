package types

type ExtractResponse struct {
	FileName   string `json:"fileName"`
	FileSize   int64  `json:"fileSize"`
	MimeType   string `json:"mimeType"`
	PageCount  int    `json:"pageCount"`
	UsedPages  int    `json:"usedPages"`
	Text       string `json:"text"`
	Truncated  bool   `json:"truncated"`
	DurationMs int64  `json:"durationMs"`
}

type ErrorResponse struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}
