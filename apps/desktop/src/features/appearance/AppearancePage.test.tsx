import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { createMemoryStore, readJson } from "../../platform/storage";
import { APPEARANCE_KEY, AppearanceProvider } from "../../settings/appearance";
import { PALETTES } from "../../theme/palettes";
import { DEFAULT_APPEARANCE, type Appearance } from "../../theme/theme";
import { AppearancePage } from "./AppearancePage";

function setup(initial: Appearance = DEFAULT_APPEARANCE) {
  const store = createMemoryStore();
  render(
    <AppearanceProvider store={store} initial={initial}>
      <AppearancePage />
    </AppearanceProvider>,
  );
  return { store, user: userEvent.setup() };
}

const root = document.documentElement;

describe("Tela de aparência", () => {
  afterEach(() => {
    root.removeAttribute("data-theme");
    root.removeAttribute("style");
  });

  it("aplica o tema escolhido na hora", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("radio", { name: /Escuro/ }));
    expect(root.dataset.theme).toBe("dark");
    await user.click(screen.getByRole("radio", { name: /Claro/ }));
    expect(root.dataset.theme).toBe("light");
  });

  it("paleta pronta troca as CSS variables e é salva", async () => {
    const { store, user } = setup();
    const oceano = PALETTES.find((p) => p.id === "oceano")!;
    await user.click(screen.getByRole("button", { name: /Oceano/ }));
    expect(root.style.getPropertyValue("--fq-primary")).toBe(oceano.primary);
    expect(root.style.getPropertyValue("--fq-accent")).toBe(oceano.accent);

    // A gravação acontece após um pequeno atraso (debounce).
    await waitFor(async () => {
      expect(await readJson(store, APPEARANCE_KEY)).toMatchObject({
        primary: oceano.primary,
        accent: oceano.accent,
        paletteId: "oceano",
      });
    });
  });

  it("avisa contraste baixo e corrige automaticamente", async () => {
    const { user } = setup({ ...DEFAULT_APPEARANCE, primary: "#ffe066", paletteId: null });
    expect(screen.getByText(/abaixo do mínimo/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Corrigir automaticamente/ }));
    expect(screen.getByText("Tudo legível")).toBeInTheDocument();
    expect(root.style.getPropertyValue("--fq-primary")).not.toBe("#ffe066");
  });
});
