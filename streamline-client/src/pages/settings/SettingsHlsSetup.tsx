import { useEffect, useMemo, useState, type FormEvent } from "react";
import { API_BASE } from "../../lib/apiBase";
import { S } from "../SettingsBilling.styles";

type SavedEmbed = {
  embedId: string;
  label: string;
  roomId: string;
  viewerPath: string;
};

type HlsCreateDraft = {
  label?: string;
};

const HLS_CREATE_DRAFT_KEY = "sl_hls_create_draft_v1";
const HLS_SELECTED_EMBED_KEY = "sl_hls_selected_embed_v1";

function loadCreateDraft(): HlsCreateDraft | null {
  try {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(HLS_CREATE_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as HlsCreateDraft;
  } catch {
    return null;
  }
}

function persistCreateDraft(draft: HlsCreateDraft) {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(HLS_CREATE_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // ignore
  }
}

function getAuthToken(): string | null {
  try {
    return window.localStorage.getItem("sl_token") || window.localStorage.getItem("auth_token");
  } catch {
    return null;
  }
}

function buildAuthHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(extra || {}),
  };
  const token = getAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function absoluteViewerUrl(roomId: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin.replace(/\/$/, "")}/live/${encodeURIComponent(roomId)}`;
}

function iframeCode(viewerUrl: string): string {
  const src = viewerUrl || "";
  if (!src) return "";
  return `<iframe src="${src}" style="width:100%;height:100%;border:0;" allow="autoplay; encrypted-media" allowfullscreen></iframe>`;
}

async function safeCopy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export default function SettingsHlsSetup({
  platformEnabled,
  canCustomize: _canCustomize,
  onUpgrade: _onUpgrade,
}: {
  platformEnabled: boolean;
  canCustomize: boolean;
  onUpgrade?: () => void;
}) {
  const [embeds, setEmbeds] = useState<SavedEmbed[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [listMessage, setListMessage] = useState<string | null>(null);

  const [selectedEmbedId, setSelectedEmbedId] = useState<string | null>(() => {
    try {
      if (typeof window === "undefined") return null;
      return window.localStorage.getItem(HLS_SELECTED_EMBED_KEY) || null;
    } catch {
      return null;
    }
  });

  const setSelectedEmbedIdAndPersist = (embedId: string | null) => {
    setSelectedEmbedId(embedId);
    try {
      if (typeof window === "undefined") return;
      if (embedId) {
        window.localStorage.setItem(HLS_SELECTED_EMBED_KEY, embedId);
      } else {
        window.localStorage.removeItem(HLS_SELECTED_EMBED_KEY);
      }
    } catch {
      // ignore
    }
  };
  const selectedEmbed = useMemo(() => embeds.find((e) => e.embedId === selectedEmbedId) || null, [embeds, selectedEmbedId]);

  // Create form
  const [createLabel, setCreateLabel] = useState(() => {
    const draft = loadCreateDraft();
    return draft?.label ?? "";
  });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createMessage, setCreateMessage] = useState<string | null>(null);

  useEffect(() => {
    const draft: HlsCreateDraft = {
      label: createLabel,
    };
    persistCreateDraft(draft);
  }, [createLabel]);

  const loadEmbeds = async (opts?: { keepSelection?: boolean }) => {
    setLoadingList(true);
    setListError(null);
    try {
      const res = await fetch(`${API_BASE}/api/saved-embeds`, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        headers: buildAuthHeaders(),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        const code = payload?.error || "server_error";
        throw new Error(String(code));
      }
      const next = Array.isArray(payload?.embeds) ? payload.embeds : [];
      setEmbeds(next);

      if (!opts?.keepSelection) {
        setSelectedEmbedIdAndPersist(next?.[0]?.embedId || null);
      } else {
        const stillExists = next.some((e: any) => e.embedId === selectedEmbedId);
        if (!stillExists) setSelectedEmbedIdAndPersist(next?.[0]?.embedId || null);
      }
    } catch (e: any) {
      setListError(e?.message || "Failed to load saved embeds");
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    loadEmbeds({ keepSelection: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleArchive = async (embedId: string) => {
    const ok = window.confirm("Archive this embed? It will be removed from the list.");
    if (!ok) return;

    setListMessage(null);
    setListError(null);
    try {
      const res = await fetch(`${API_BASE}/api/saved-embeds/${encodeURIComponent(embedId)}`, {
        method: "PUT",
        credentials: "include",
        headers: buildAuthHeaders(),
        body: JSON.stringify({ archived: true }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to archive");
      }
      setListMessage("Archived");
      await loadEmbeds({ keepSelection: false });
    } catch (e: any) {
      setListError(e?.message || "Failed to archive");
    }
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setCreateMessage(null);

    const label = String(createLabel || "").trim();
    if (!label) {
      setCreateError("Label is required");
      return;
    }

    setCreating(true);
    try {
      const res = await fetch(`${API_BASE}/api/saved-embeds`, {
        method: "POST",
        credentials: "include",
        headers: buildAuthHeaders(),
        body: JSON.stringify({
          label,
        }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to create embed");
      }

      const created = payload?.embed as SavedEmbed | undefined;
      setCreateMessage("Created");

      await loadEmbeds({ keepSelection: true });

      if (created?.embedId) {
        setSelectedEmbedId(created.embedId);
      }
    } catch (e: any) {
      setCreateError(e?.message || "Failed to create embed");
    } finally {
      setCreating(false);
    }
  };


  const panelStyle = {
    border: "1px solid rgba(63,63,70,0.45)",
    borderRadius: 14,
    padding: 16,
    background: "rgba(255,255,255,0.02)",
  } as const;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(300px, 1.1fr) minmax(280px, 0.9fr)", gap: 16 }}>
      {/* Left column: Create + Branding editor */}
      <div style={{ display: "grid", gap: 16 }}>
        {/* B) Create new embed */}
        <div style={panelStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div style={{ fontWeight: 800, color: "#e5e7eb" }}>Create new embed</div>
            {createMessage && (
              <div style={{ padding: "4px 10px", borderRadius: 999, border: "1px solid rgba(34,197,94,0.35)", background: "rgba(34,197,94,0.10)", color: "#bbf7d0", fontSize: 12, fontWeight: 800 }}>
                {createMessage}
              </div>
            )}
          </div>

          {createError && (
            <div style={{ marginTop: 10, padding: "8px 10px", borderRadius: 10, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.35)", color: "#fca5a5", fontSize: 13 }}>
              {createError}
            </div>
          )}

          <form onSubmit={handleCreate} style={{ marginTop: 12, display: "grid", gap: 10 }}>
            <div style={{ display: "grid", gap: 6 }}>
              <label style={{ fontSize: 12, color: "#9ca3af", fontWeight: 800 }}>Label</label>
              <input
                type="text"
                value={createLabel}
                onChange={(e) => setCreateLabel(e.target.value)}
                placeholder="e.g. My Weekly Show"
                maxLength={60}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid rgba(63,63,70,0.6)",
                  background: "rgba(0,0,0,0.25)",
                  color: "#e5e7eb",
                  fontSize: 13,
                }}
              />
            </div>
            <div style={{ fontSize: 12, color: "#9ca3af" }}>
              Branding (title, logo, colors, offline message) is coming soon.
              For now, each embed uses a default viewer page you can share.
            </div>

            <button type="submit" disabled={creating} style={{ ...S.primaryBtn, padding: "12px 16px", fontSize: 14 }}>
              {creating ? "Creating…" : "Create Embed"}
            </button>
          </form>

          {!platformEnabled && (
            <div style={{ marginTop: 10, color: "#fde68a", fontSize: 12, fontWeight: 800 }}>
              Note: HLS is disabled platform-wide right now. Viewer pages still work (offline) and links are still shareable.
            </div>
          )}
        </div>

        {/* C) Branding (coming soon) */}
        <div style={panelStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div style={{ fontWeight: 800, color: "#e5e7eb" }}>Branding (coming soon)</div>
          </div>

          {!selectedEmbed && (
            <div style={{ marginTop: 10, color: "#9ca3af", fontSize: 13 }}>
              Select an embed from the list on the right to see its viewer link.
            </div>
          )}

          {selectedEmbed && (
            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              <div style={{ fontSize: 13, color: "#9ca3af" }}>
                Selected embed: <span style={{ color: "#e5e7eb", fontWeight: 800 }}>{selectedEmbed.label}</span>
              </div>

              <div style={{ fontSize: 12, color: "#9ca3af" }}>
                Embed page URL: <span style={{ color: "#e5e7eb" }}>{absoluteViewerUrl(selectedEmbed.roomId)}</span>
              </div>

              <div
                style={{
                  marginTop: 4,
                  padding: "10px 12px",
                  borderRadius: 12,
                  background: "rgba(30,64,175,0.25)",
                  border: "1px solid rgba(59,130,246,0.6)",
                  color: "#dbeafe",
                  fontSize: 13,
                }}
              >
                Branding controls (title, logo, colors, offline message) are coming soon.
                For now, share the viewer link or embed code from the Saved Embeds list on the right.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right column: Saved Embeds list */}
      <div style={panelStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ fontWeight: 800, color: "#e5e7eb" }}>Saved Embeds</div>
          <button
            type="button"
            style={{ ...S.secondaryBtn, padding: "8px 12px", fontSize: 13 }}
            onClick={() => loadEmbeds({ keepSelection: true })}
            disabled={loadingList}
          >
            {loadingList ? "Loading…" : "Refresh"}
          </button>
        </div>

        {listError && (
          <div style={{ marginTop: 10, padding: "8px 10px", borderRadius: 10, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.35)", color: "#fca5a5", fontSize: 13 }}>
            {listError}
          </div>
        )}
        {listMessage && (
          <div style={{ marginTop: 10, padding: "8px 10px", borderRadius: 10, background: "rgba(34,197,94,0.10)", border: "1px solid rgba(34,197,94,0.35)", color: "#bbf7d0", fontSize: 13 }}>
            {listMessage}
          </div>
        )}

        <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
          {embeds.length === 0 && (
            <div style={{ color: "#9ca3af", fontSize: 13 }}>No saved embeds yet. Create one first.</div>
          )}

          {embeds.map((embed) => {
            const viewerUrl = absoluteViewerUrl(embed.roomId);
            const selected = embed.embedId === selectedEmbedId;
            return (
              <div
                key={embed.embedId}
                style={{
                  border: `1px solid ${selected ? "rgba(239,68,68,0.55)" : "rgba(63,63,70,0.4)"}`,
                  borderRadius: 12,
                  padding: 12,
                  background: selected ? "rgba(239,68,68,0.06)" : "rgba(0,0,0,0.15)",
                  display: "grid",
                  gap: 10,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                  <div style={{ fontWeight: 700 }}>{embed.label}</div>
                  <button
                    type="button"
                    style={{ ...S.secondaryBtn, padding: "8px 10px", fontSize: 12 }}
                    onClick={() => setSelectedEmbedIdAndPersist(embed.embedId)}
                  >
                    {selected ? "Selected" : "Select"}
                  </button>
                </div>

                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontSize: 12, color: "#9ca3af", fontWeight: 800 }}>Embed link</div>
                  <input
                    type="text"
                    readOnly
                    value={viewerUrl}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: "1px solid rgba(63,63,70,0.6)",
                      background: "rgba(0,0,0,0.25)",
                      color: "#e5e7eb",
                      fontSize: 13,
                    }}
                  />
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    style={{ ...S.secondaryBtn, padding: "8px 12px", fontSize: 13 }}
                    onClick={async () => {
                      const ok = await safeCopy(viewerUrl);
                      setListMessage(ok ? "Viewer link copied" : "Copy failed");
                    }}
                  >
                    Copy Viewer Link
                  </button>
                  <button
                    type="button"
                    style={{ ...S.secondaryBtn, padding: "8px 12px", fontSize: 13 }}
                    onClick={async () => {
                      const ok = await safeCopy(iframeCode(viewerUrl));
                      setListMessage(ok ? "Embed code copied" : "Copy failed");
                    }}
                  >
                    Copy Embed Code
                  </button>
                  <button
                    type="button"
                    style={{ ...S.secondaryBtn, padding: "8px 12px", fontSize: 13, borderColor: "rgba(239,68,68,0.4)", color: "#fca5a5" }}
                    onClick={() => handleArchive(embed.embedId)}
                  >
                    Archive
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
