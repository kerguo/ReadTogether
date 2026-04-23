package handler

import (
	"net/http"

	"github.com/zeromicro/go-zero/rest"

	v1 "readtogether-api/internal/handler/v1"
	"readtogether-api/internal/svc"
)

func RegisterHandlers(server *rest.Server, ctx *svc.ServiceContext) {
	apiGroup := v1.NewAPIGroup(ctx)

	server.AddRoutes([]rest.Route{
		{
			Method:  http.MethodGet,
			Path:    "/api/dashboard",
			Handler: apiGroup.Dashboard,
		},
		{
			Method:  http.MethodGet,
			Path:    "/api/groups/:id",
			Handler: apiGroup.GetGroup,
		},
		{
			Method:  http.MethodPost,
			Path:    "/api/groups/:id/documents",
			Handler: apiGroup.UploadGroupDocument,
		},
		{
			Method:  http.MethodGet,
			Path:    "/api/documents/:id",
			Handler: apiGroup.GetDocument,
		},
		{
			Method:  http.MethodPost,
			Path:    "/api/documents/:id/annotations",
			Handler: apiGroup.CreateAnnotation,
		},
		{
			Method:  http.MethodPost,
			Path:    "/api/documents/:id/chat",
			Handler: apiGroup.CreateChatMessage,
		},
		{
			Method:  http.MethodGet,
			Path:    "/api/discussions",
			Handler: apiGroup.ListDiscussions,
		},
		{
			Method:  http.MethodPost,
			Path:    "/api/discussions",
			Handler: apiGroup.CreateDiscussion,
		},
	})
}
