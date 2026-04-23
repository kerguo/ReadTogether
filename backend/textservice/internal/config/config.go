package config

import "github.com/zeromicro/go-zero/rest"

type Config struct {
	rest.RestConf
	MaxUploadBytes int64 `json:"maxUploadBytes,optional" yaml:"maxUploadBytes"` // 限制上传体积，避免 OOM
	MaxPages       int   `json:"maxPages,optional" yaml:"maxPages"`             // 提取的最大页数
}
