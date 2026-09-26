import fs from "node:fs";
import { test, expect, type APIResponse, type Page } from "@playwright/test";

async function json(response: APIResponse) {
  const payload = await response.json();
  expect(response.ok(), JSON.stringify(payload)).toBe(true);
  return payload;
}

async function actionGeometry(page: Page, saveLabel: string, navLabel: string) {
  const save = page.getByRole("button", { name: saveLabel, exact: true });
  const nav = page.getByRole("navigation", { name: navLabel, exact: true });
  const button = await save.boundingBox();
  const bar = await save.locator("xpath=ancestor::footer").boundingBox();
  const navigation = await nav.boundingBox();
  return { button, bar, navigation };
}

async function recordGeometry(page: Page, saveLabel: string, navLabel: string, name: string) {
  const path = test.info().outputPath(`${name}.json`);
  fs.writeFileSync(path, JSON.stringify({ viewport: page.viewportSize(), ...await actionGeometry(page, saveLabel, navLabel) }, null, 2));
  await test.info().attach(name, { path, contentType: "application/json" });
}

for (const streamlined of [true, false]) {
  for (const scenario of [
    { width: 320, language: "en", safeBottom: 0 },
    { width: 390, language: "zh-CN", safeBottom: 34 },
    { width: 430, language: "en", safeBottom: 34 },
    { width: 1280, language: "zh-CN", safeBottom: 0 },
  ]) {
    test(`agent config actions clear navigation: ${streamlined ? "streamlined" : "classic"} ${scenario.width}px ${scenario.language}`, async ({ page, request }) => {
      const company = await json(await request.post("/api/companies", {
        data: { name: `Mobile actions ${Date.now()}` },
      }));
      const settings = await json(await request.get("/api/instance/settings/experimental"));
      const agent = await json(await request.post(`/api/companies/${company.id}/agents`, { data: {
        name: "Mobile actions fixture", role: "engineer", adapterType: "process",
        adapterConfig: { command: "/usr/bin/true" },
        runtimeConfig: { heartbeat: { enabled: false, wakeOnDemand: false } },
      } }));
      page.setDefaultTimeout(10_000);
      const chinese = scenario.language === "zh-CN";
      const saveLabel = chinese ? "保存更改" : "Save changes";
      const navLabel = chinese ? "移动端导航" : "Mobile navigation";
      const draftName = `Saved ${scenario.width} ${scenario.language}`;
      try {
        await json(await request.patch("/api/instance/settings/experimental", { data: { enableStreamlinedUi: streamlined } }));
        await page.route("**/api/announcements/current", (route) => route.fulfill({ json: null }));
        await page.addInitScript((language) => {
          if (!localStorage.getItem("paperclip.ui.language")) localStorage.setItem("paperclip.ui.language", language);
        }, scenario.language);
        await page.setViewportSize({ width: scenario.width, height: 844 });
        await page.goto(`/${company.issuePrefix}/agents/${agent.urlKey ?? agent.id}/runtime`);
        const nameInput = page.locator("input").filter({ visible: true }).first();
        await nameInput.waitFor({ state: "visible" });
        await expect(nameInput).toHaveValue("Mobile actions fixture");
        await page.addStyleTag({ content: `:root { --sz-safe-bottom: ${scenario.safeBottom}px; }` });
        await nameInput.fill(draftName);
        if (scenario.width < 768) {
          await page.getByRole("button", { name: chinese ? "打开侧边栏" : "Open sidebar", exact: true }).click();
        }
        const firstToggle = page.getByRole("button", { name: chinese ? "切换到英文" : "Switch to Chinese", exact: true });
        await firstToggle.focus();
        await firstToggle.press("Enter");
        await expect(page.locator("html")).toHaveAttribute("lang", chinese ? "en" : "zh-CN");
        await page.getByRole("button", { name: chinese ? "Switch to Chinese" : "切换到英文", exact: true }).press("Space");
        await expect(page.locator("html")).toHaveAttribute("lang", scenario.language);
        if (scenario.width < 768) {
          await page.getByRole("button", { name: chinese ? "关闭侧边栏" : "Close sidebar", exact: true }).click({ position: { x: scenario.width - 2, y: 400 } });
        }
        await expect(nameInput).toHaveValue(draftName);
        expect((await json(await request.get(`/api/agents/${agent.id}`))).name).toBe("Mobile actions fixture");
        const save = page.getByRole("button", { name: saveLabel, exact: true });
        await expect(save).toBeEnabled();
        if (scenario.width < 768) {
          await page.evaluate(() => window.scrollTo(0, 0));
          await expect.poll(async () => {
            const { button, bar, navigation } = await actionGeometry(page, saveLabel, navLabel);
            return !!button && !!bar && !!navigation && bar.y + bar.height <= navigation.y + 1;
          }, { message: "Save action must remain above the visible bottom navigation" }).toBe(true);
          await recordGeometry(page, saveLabel, navLabel, "navigation-visible");
          // Exercise the existing scroll-to-hide navigation behavior.
          await page.evaluate(() => window.scrollTo(0, 500));
          await expect.poll(async () => {
            const box = await page.getByRole("navigation", { name: navLabel, exact: true }).boundingBox();
            return box ? box.y >= 843 : false;
          }).toBe(true);
          await expect.poll(async () => {
            const { button, bar } = await actionGeometry(page, saveLabel, navLabel);
            return !!button && !!bar && button.y >= 0 && bar.y + bar.height <= 844 - scenario.safeBottom + 1;
          }, { message: "Hidden navigation must leave actions above the device safe area" }).toBe(true);
          await recordGeometry(page, saveLabel, navLabel, "navigation-hidden");
          await page.evaluate(() => window.scrollTo(0, 0));
          await expect.poll(async () => {
            const { button, bar, navigation } = await actionGeometry(page, saveLabel, navLabel);
            return !!button && !!bar && !!navigation && navigation.y < 844 && bar.y + bar.height <= navigation.y + 1;
          }).toBe(true);
          // Chromium viewport shrink emulates a keyboard reducing available
          // layout height; it does not certify a physical iOS keyboard.
          await nameInput.focus();
          await page.setViewportSize({ width: scenario.width, height: 420 });
          await page.evaluate(() => window.scrollTo(0, 0));
          await expect.poll(async () => {
            const { button, bar, navigation } = await actionGeometry(page, saveLabel, navLabel);
            return !!button && !!bar && !!navigation && button.y >= 0 && bar.y + bar.height <= navigation.y + 1;
          }).toBe(true);
          await recordGeometry(page, saveLabel, navLabel, "keyboard-viewport-simulation");
          await page.setViewportSize({ width: scenario.width, height: 844 });
          await page.evaluate(() => window.scrollTo(0, 0));
        } else {
          await expect(page.getByRole("navigation", { name: navLabel, exact: true })).toHaveCount(0);
        }
        await save.click();
        await expect.poll(async () => (await json(await request.get(`/api/agents/${agent.id}`))).name).toBe(draftName);
        await expect(save).toBeDisabled();
        await page.reload();
        await expect(page.locator("html")).toHaveAttribute("lang", scenario.language);
        await expect(nameInput).toHaveValue(draftName);
        await page.screenshot({ path: test.info().outputPath("saved-actions.png") });
      } finally {
        await request.patch("/api/instance/settings/experimental", { data: { enableStreamlinedUi: settings.enableStreamlinedUi } }).catch(() => {});
        await request.patch(`/api/companies/${company.id}`, { data: { status: "archived" } }).catch(() => {});
      }
    });
  }
}

for (const language of ["en", "zh-CN"]) {
  test(`agent config actions remain reachable with announcements: 390px ${language}`, async ({ page, request }) => {
    const company = await json(await request.post("/api/companies", { data: { name: `Announcement actions ${Date.now()}` } }));
    const settings = await json(await request.get("/api/instance/settings/experimental"));
    const agent = await json(await request.post(`/api/companies/${company.id}/agents`, { data: {
      name: "Announcement fixture", role: "engineer", adapterType: "process",
      adapterConfig: { command: "/usr/bin/true" },
      runtimeConfig: { heartbeat: { enabled: false, wakeOnDemand: false } },
    } }));
    const chinese = language === "zh-CN";
    const saveLabel = chinese ? "保存更改" : "Save changes";
    const navLabel = chinese ? "移动端导航" : "Mobile navigation";
    const announcement = {
      id: "mobile-actions-fixture",
      eyebrow: "Introducing Connectors",
      title: "Give your agents the access they need",
      description: "Connect Gmail, GitHub, Notion, and more. Choose which agents get access, which accounts they use, and which actions they can take.",
      image: { path: `assets/${"a".repeat(64)}.png`, alt: "Connectors fixture" },
      primaryAction: { kind: "route", label: "Explore connectors", path: "/apps" },
    };
    let dismissCount = 0;
    try {
      await json(await request.patch("/api/instance/settings/experimental", { data: { enableStreamlinedUi: true } }));
      await page.route("**/api/announcements/current", (route) => route.fulfill({ json: announcement }));
      await page.route("**/api/announcements/mobile-actions-fixture/image", (route) => route.fulfill({
        contentType: "image/png", body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO5+j1sAAAAASUVORK5CYII=", "base64"),
      }));
      await page.route("**/api/announcements/mobile-actions-fixture/dismiss", (route) => {
        dismissCount++;
        return route.fulfill({ status: 204 });
      });
      await page.addInitScript((value) => localStorage.setItem("paperclip.ui.language", value), language);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.emulateMedia({ reducedMotion: chinese ? "reduce" : "no-preference" });
      await page.goto(`/${company.issuePrefix}/agents/${agent.urlKey ?? agent.id}/runtime`);
      const nameInput = page.locator("input").filter({ visible: true }).first();
      await nameInput.waitFor({ state: "visible" });
      await expect(nameInput).toHaveValue("Announcement fixture");
      await page.addStyleTag({ content: ":root { --sz-safe-bottom: 34px; }" });
      await nameInput.fill(`Saved announcement ${language}`);
      const save = page.getByRole("button", { name: saveLabel, exact: true });
      await expect(save).toBeEnabled();
      const card = page.getByRole("region", { name: announcement.title, exact: true });
      await expect(card).toBeVisible();
      await expect(card.locator("img")).toBeVisible();
      if (chinese) {
        const duration = await card.locator("xpath=ancestor::aside").evaluate((element) => getComputedStyle(element).transitionDuration);
        expect(duration).toBe("0s");
        expect(await save.locator("xpath=ancestor::footer").evaluate((element) => getComputedStyle(element).transitionProperty)).toBe("none");
      }
      await page.evaluate(() => window.scrollTo(0, 0));
      const saveReceivesPointer = () => save.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return element.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
      });
      await page.screenshot({ path: test.info().outputPath("announcement-and-actions.png") });
      await expect.poll(saveReceivesPointer, { message: "Announcement must not intercept the Save action" }).toBe(true);
      // Compare the clipped announcement viewport, not the potentially taller
      // scrollable Card child, and sample both boundaries in the same frame.
      const assertCardClearsActions = () => page.evaluate(() => {
        const well = document.querySelector<HTMLElement>(".announcement-well");
        const bar = document.querySelector<HTMLElement>("[data-mobile-action-bar]");
        return !!well && !!bar && well.getBoundingClientRect().bottom <= bar.getBoundingClientRect().top + 1;
      });
      await expect.poll(assertCardClearsActions).toBe(true);
      // The status and buttons wrap at this width; the announcement follows
      // the measured height instead of assuming a one-row footer.
      await page.setViewportSize({ width: 320, height: 844 });
      await expect.poll(assertCardClearsActions).toBe(true);
      await expect.poll(saveReceivesPointer).toBe(true);
      await page.setViewportSize({ width: 390, height: 420 });
      await page.evaluate(() => window.scrollTo(0, 0));
      await expect.poll(assertCardClearsActions).toBe(true);
      const dismiss = card.getByRole("button", { name: chinese ? "关闭公告" : "Dismiss announcement", exact: true });
      await expect.poll(() => dismiss.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return rect.top >= 0 && rect.bottom <= window.innerHeight
          && element.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
      }), { message: "The clipped announcement must keep its dismiss control reachable in a short viewport" }).toBe(true);
      await page.screenshot({ path: test.info().outputPath("announcement-short-viewport.png") });
      await page.setViewportSize({ width: 390, height: 844 });
      await expect.poll(assertCardClearsActions).toBe(true);
      for (const scrollTop of [500, 0]) {
        const blockedFrames = await page.evaluate(async ({ top, label }) => {
          const blocked: number[] = [];
          window.scrollTo(0, top);
          for (let frame = 0; frame < 20; frame++) {
            await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
            const button = Array.from(document.querySelectorAll<HTMLButtonElement>("button"))
              .find((candidate) => candidate.textContent?.trim() === label)!;
            const rect = button.getBoundingClientRect();
            if (!button.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2))) blocked.push(frame);
          }
          return blocked;
        }, { top: scrollTop, label: saveLabel });
        expect(blockedFrames, "Navigation transitions must not move the announcement over Save").toEqual([]);
        await expect.poll(assertCardClearsActions).toBe(true);
      }
      await save.click();
      await expect.poll(async () => (await json(await request.get(`/api/agents/${agent.id}`))).name).toBe(`Saved announcement ${language}`);
      // The existing policy yields to the save toast, then shows the same card.
      await expect(card).toBeVisible({ timeout: 15_000 });
      // Process agents have a short instructions page. Its sticky footer can
      // remain in normal flow above the dock, so height + nav inset is insufficient.
      const savedAgent = await json(await request.get(`/api/agents/${agent.id}`));
      await page.goto(`/${company.issuePrefix}/agents/${savedAgent.urlKey ?? agent.id}/instructions`);
      await save.waitFor({ state: "visible" });
      await page.addStyleTag({ content: ":root { --sz-safe-bottom: 34px; }" });
      await expect(card).toBeVisible();
      await expect.poll(assertCardClearsActions, { message: "Announcement must clear a footer that is not pinned to the viewport edge" }).toBe(true);
      await recordGeometry(page, saveLabel, navLabel, "short-page-actions");
      fs.writeFileSync(test.info().outputPath("short-page-announcement.json"), JSON.stringify(await card.locator("xpath=ancestor::aside").boundingBox(), null, 2));
      const shortPage = await actionGeometry(page, saveLabel, navLabel);
      expect(shortPage.bar!.y + shortPage.bar!.height).toBeLessThan(shortPage.navigation!.y - 1);
      await page.screenshot({ path: test.info().outputPath("announcement-short-page.png") });
      const beforeDismiss = await actionGeometry(page, saveLabel, navLabel);
      await card.getByRole("button", { name: chinese ? "关闭公告" : "Dismiss announcement", exact: true }).click();
      await expect(card).toHaveCount(0);
      const afterDismiss = await actionGeometry(page, saveLabel, navLabel);
      expect(afterDismiss.bar!.y).toBeCloseTo(beforeDismiss.bar!.y, 0);
      expect(afterDismiss.navigation!.y).toBeCloseTo(beforeDismiss.navigation!.y, 0);
      await expect.poll(() => dismissCount).toBe(1);
      await page.screenshot({ path: test.info().outputPath("announcement-dismissed.png") });
    } finally {
      await request.patch("/api/instance/settings/experimental", { data: { enableStreamlinedUi: settings.enableStreamlinedUi } }).catch(() => {});
      await request.patch(`/api/companies/${company.id}`, { data: { status: "archived" } }).catch(() => {});
    }
  });
}
