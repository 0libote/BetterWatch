import { createTheme, CssBaseline, ThemeProvider } from "@mui/material";
import { ReactNode, useEffect, useMemo, useState } from "react";
import "@fontsource-variable/manrope";
import { useAppState } from "./state";

export function AppTheme({ children }: { children: ReactNode }) {
  const { options } = useAppState();
  const [systemDark, setSystemDark] = useState(
    matchMedia("(prefers-color-scheme: dark)").matches,
  );
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const change = () => setSystemDark(media.matches);
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  const mode =
    options.theme === "light"
      ? "light"
      : options.theme === "system"
        ? systemDark
          ? "dark"
          : "light"
        : "dark";
  useEffect(() => {
    document.documentElement.dataset.theme = mode;
  }, [mode]);
  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode,
          primary: { main: mode === "dark" ? "#b5a2f3" : "#6b4bc4" },
          background: {
            default: mode === "dark" ? "#181922" : "#f4f3f8",
            paper: mode === "dark" ? "#20212d" : "#ffffff",
          },
        },
        typography: {
          fontFamily: '"Manrope Variable", sans-serif',
          button: { textTransform: "none", fontWeight: 700 },
        },
        shape: { borderRadius: 12 },
        components: {
          MuiDialog: { styleOverrides: { paper: { backgroundImage: "none" } } },
          MuiButton: { defaultProps: { disableElevation: true } },
          MuiCssBaseline: { styleOverrides: { body: { margin: 0 } } },
        },
      }),
    [mode],
  );
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
