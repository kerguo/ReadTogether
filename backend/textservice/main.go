package main

import (
	"flag"
	"fmt"

	"github.com/zeromicro/go-zero/core/conf"
	"github.com/zeromicro/go-zero/rest"

	"readtogether-textservice/internal/config"
	"readtogether-textservice/internal/handler"
	"readtogether-textservice/internal/svc"
)

var configFile = flag.String("f", "etc/text-api.yaml", "the config file")

func main() {
	flag.Parse()

	var c config.Config
	conf.MustLoad(*configFile, &c)

	if c.MaxUploadBytes == 0 {
		c.MaxUploadBytes = 20 * 1024 * 1024 // 20 MB default
	}
	if c.MaxPages == 0 {
		c.MaxPages = 10
	}
	if c.RestConf.MaxBytes == 0 && c.MaxUploadBytes > 0 {
		c.RestConf.MaxBytes = c.MaxUploadBytes
	}

	server := rest.MustNewServer(c.RestConf)
	defer server.Stop()

	ctx := svc.NewServiceContext(c)
	handler.RegisterHandlers(server, ctx)

	fmt.Printf("Starting server at %s:%d...\n", c.Host, c.Port)
	server.Start()
}
