package svc

import (
	"context"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	supabase "github.com/supabase-community/supabase-go"
	"github.com/zeromicro/go-zero/core/logx"

	"readtogether-api/internal/config"
	"readtogether-api/internal/model"
)

type ServiceContext struct {
	Config        config.Config
	Supabase      *supabase.Client
	StorageBucket string
	DB            *pgxpool.Pool
	HttpClient    *http.Client
	Model         *model.Model
}

func NewServiceContext(c config.Config) *ServiceContext {
	supa, err := supabase.NewClient(c.Supabase.Url, c.Supabase.ServiceKey, nil)
	if err != nil {
		logx.Errorf("failed to create supabase client: %v", err)
		panic(err)
	}

	db, err := pgxpool.New(context.Background(), c.Supabase.DatabaseUrl)
	if err != nil {
		logx.Errorf("failed to connect to supabase database: %v", err)
		panic(err)
	}

	timeout := time.Duration(c.TextService.Timeout) * time.Second
	if timeout <= 0 {
		timeout = 15 * time.Second
	}

	return &ServiceContext{
		Config:        c,
		Supabase:      supa,
		StorageBucket: c.Supabase.Bucket,
		DB:            db,
		HttpClient: &http.Client{
			Timeout: timeout,
		},
		Model: model.NewModel(db),
	}
}
