import { useEffect } from "react";
import legacyScriptUrl from "../app.js?url";
import legacyStylesUrl from "../styles.css?url";
import { legacyMarkup } from "./legacyMarkup";

export function App() {
  useEffect(() => {
    const styleId = "casino-fsp-legacy-style";
    const scriptId = "casino-fsp-legacy-script";

    if (!document.getElementById(styleId)) {
      const link = document.createElement("link");
      link.id = styleId;
      link.rel = "stylesheet";
      link.href = legacyStylesUrl;
      document.head.appendChild(link);
    }

    const existingScript = document.getElementById(scriptId);
    if (existingScript) {
      existingScript.remove();
    }

    const script = document.createElement("script");
    script.id = scriptId;
    script.src = legacyScriptUrl;
    script.async = false;
    document.body.appendChild(script);

    return () => {
      script.remove();
    };
  }, []);

  return <div dangerouslySetInnerHTML={{ __html: legacyMarkup }} />;
}
