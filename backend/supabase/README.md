# Supabase 初始化脚本

本目录用于管理 Supabase 项目的初始化脚本及相关说明。

## 目录结构

- `000_init.sql`：核心数据库结构初始化脚本，包含 ReadTogether 所需的表、触发器与索引定义。

## 使用方式

1. **准备环境变量**
   - 确保 Supabase 项目已经创建，并记录数据库连接字符串。
   - 后端 API 需要的环境变量见 `backend/api/etc/api.example.yaml`，在部署/本地调试时配置为真实值。

2. **导入脚本**
   - 打开 Supabase Studio → `SQL Editor`，粘贴 `000_init.sql` 内容后执行；
   - 或在本地使用 CLI：
     ```bash
     supabase db push --file backend/supabase/000_init.sql
     ```

3. **注意事项**
   - 脚本会创建一个默认的 `profiles` 记录（`is_self = true`）用于后端示例数据。
   - 目前未启用 Row Level Security，可根据业务需要在 Supabase 后台开启并配置策略。
   - 若后续有更多迁移，按顺序新建 `001_*.sql`, `002_*.sql` 等文件。
