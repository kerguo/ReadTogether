# ReadTogether

Frontend code lives in the **`frontend/`** folder.

```bash
cd frontend && npm install && npm run dev
```

## Vercel 部署

在 Vercel 项目 **Settings → General → Root Directory** 中，只能使用下面**两种之一**：

1. **推荐：** 填 **`frontend`**（指向含 `package.json` 的源码目录，不要选 `dist` 或 `frontend/dist`）。构建由 `frontend/vercel.json` 与 Vite 完成，产物为 `frontend/dist`。
2. **备选：** 留空（使用**仓库根目录**），由仓库根目录的 `vercel.json` 中 `cd frontend && …` 负责构建与输出路径。

`dist` / `frontend/dist` 是 `npm run build` 的**输出目录**，不会出现在 Git 里，**不要**设成 Root Directory。

---

# React + Vite (frontend)

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
