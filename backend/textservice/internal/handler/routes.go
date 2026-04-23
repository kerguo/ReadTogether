package handler

import (
	"net/http"

	"github.com/zeromicro/go-zero/rest"

	"readtogether-textservice/internal/svc"
)

func RegisterHandlers(server *rest.Server, serverCtx *svc.ServiceContext) {
	server.AddRoutes(
		[]rest.Route{
			{
				Method:  http.MethodPost,
				Path:    "/extract",
				Handler: ExtractHandler(serverCtx),
			},
		},
	)
}
