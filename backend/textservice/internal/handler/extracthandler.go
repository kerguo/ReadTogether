package handler

import (
	"io"
	"net/http"

	"github.com/zeromicro/go-zero/rest/httpx"

	"readtogether-textservice/internal/logic"
	"readtogether-textservice/internal/svc"
	"readtogether-textservice/internal/types"
)

func ExtractHandler(svcCtx *svc.ServiceContext) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Limit upload size to protect memory usage.
		if svcCtx.Config.MaxUploadBytes > 0 {
			r.Body = http.MaxBytesReader(w, r.Body, svcCtx.Config.MaxUploadBytes)
		}
		if err := r.ParseMultipartForm(svcCtx.Config.MaxUploadBytes); err != nil {
			httpx.WriteJson(w, http.StatusBadRequest, types.ErrorResponse{
				Code:    "bad_request",
				Message: "上传文件过大或格式不正确",
			})
			return
		}

		file, header, err := r.FormFile("file")
		if err != nil {
			httpx.WriteJson(w, http.StatusBadRequest, types.ErrorResponse{
				Code:    "missing_file",
				Message: "请通过 form-data 字段 file 上传 PDF 文件",
			})
			return
		}
		defer file.Close()

		data, err := io.ReadAll(file)
		if err != nil {
			httpx.WriteJson(w, http.StatusInternalServerError, types.ErrorResponse{
				Code:    "read_error",
				Message: "读取上传文件失败",
			})
			return
		}

		l := logic.NewExtractLogic(r.Context(), svcCtx)
		resp, err := l.Process(header.Filename, header.Header.Get("Content-Type"), header.Size, data)
		if err != nil {
			httpx.WriteJson(w, http.StatusBadRequest, types.ErrorResponse{
				Code:    "parse_error",
				Message: err.Error(),
			})
			return
		}

		httpx.OkJsonCtx(r.Context(), w, resp)
	}
}
