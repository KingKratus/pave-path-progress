import { test, expect } from "@playwright/test";

test("homepage carrega e mostra busca", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByPlaceholder(/Duque de Caxias/i)).toBeVisible();
  await expect(page.getByRole("heading", { name: /Cada rua sem asfalto/i })).toBeVisible();
});

test("navegação para Buscar funciona", async ({ page }) => {
  await page.goto("/buscar");
  await expect(page.getByRole("heading", { name: "Buscar" })).toBeVisible();
  await page.getByPlaceholder(/Cidade, rua ou bairro/i).fill("São");
  // espera debounce
  await page.waitForTimeout(500);
});

test("ranking renderiza", async ({ page }) => {
  await page.goto("/ranking");
  await expect(page.getByRole("heading", { name: /Os melhores em pavimentação/i })).toBeVisible();
});

test("auth exibe formulário", async ({ page }) => {
  await page.goto("/auth");
  await expect(page.getByRole("heading", { name: /Entrar/i }).first()).toBeVisible();
});

test("sobre carrega", async ({ page }) => {
  await page.goto("/sobre");
  await expect(page.getByText(/Transparência viária/i)).toBeVisible();
});

test("admin redireciona anônimo para /auth", async ({ page }) => {
  await page.goto("/admin");
  // aguarda hidratação da role
  await page.waitForURL(/\/auth/, { timeout: 5000 }).catch(() => {});
  const url = new URL(page.url());
  // ou está em /auth (não-logado) ou em /admin exibindo "Acesso restrito"
  if (url.pathname === "/admin") {
    await expect(page.getByRole("heading", { name: /Acesso restrito/i })).toBeVisible();
  } else {
    expect(url.pathname).toMatch(/\/auth/);
  }
});

test("busca por bairro aparece na home", async ({ page }) => {
  await page.goto("/");
  const input = page.getByPlaceholder(/Duque de Caxias/i);
  await input.fill("Centr");
  await page.waitForTimeout(600);
  // Deve mostrar ao menos a seção Municípios ou Bairros
  const dropdown = page.locator("text=/Municípios|Bairros/").first();
  await expect(dropdown).toBeVisible({ timeout: 3000 });
});
