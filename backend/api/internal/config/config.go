package config

import (
	"github.com/zeromicro/go-zero/core/stores/cache"
	"github.com/zeromicro/go-zero/rest"
)

type SupabaseConfig struct {
	Url         string `json:"url" yaml:"url"`
	ServiceKey  string `json:"serviceKey" yaml:"serviceKey"`
	AnonKey     string `json:"anonKey,optional" yaml:"anonKey"`
	DatabaseUrl string `json:"databaseUrl" yaml:"databaseUrl"`
	Bucket      string `json:"bucket" yaml:"bucket"`
}

type TextServiceConfig struct {
	BaseURL string `json:"baseUrl" yaml:"baseUrl"`
	Timeout int    `json:"timeout,optional" yaml:"timeout"`
}

type Config struct {
	rest.RestConf
	Cache       cache.CacheConf   `json:"cache,optional" yaml:"cache"`
	Supabase    SupabaseConfig    `json:"supabase" yaml:"supabase"`
	TextService TextServiceConfig `json:"textService" yaml:"textService"`
	Storage     struct {
		MaxUploadBytes int64 `json:"maxUploadBytes,optional" yaml:"maxUploadBytes"`
	} `json:"storage" yaml:"storage"`
}
