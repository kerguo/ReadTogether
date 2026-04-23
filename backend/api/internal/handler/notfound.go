package handler

import (
	"net/http"

	"github.com/zeromicro/go-zero/rest/httpx"

	"readtogether-api/internal/types"
)

// NotFoundHandler returns an http.Handler that responds with a JSON 404 payload.
func NotFoundHandler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		httpx.WriteJson(w, http.StatusNotFound, types.ErrorResponse{
			Code:    "not_found",
			Message: "接口不存在",
		})
	})
}
