import { useState, useRef, useEffect } from "react";



/* ════════════════════════════════════════════════════════
   SHARED CONSTANTS
════════════════════════════════════════════════════════ */
const ALPHABET   = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const CARD_COLORS = ["#1a1a2e","#16213e","#0f3460","#1b262c","#162447","#1f4068","#1b1b2f","#2c3e50","#1a1a1a","#2d132c"];
const SK_WORDS   = "lexicon_words_v1";
const SK_PHRASES = "phrasicon_phrases_v1";
const DIFF_COLORS = { easy:"#22c55e", medium:"#f59e0b", hard:"#ef4444", expert:"#a855f7" };
const REG_COLORS  = { formal:"#60a5fa", informal:"#34d399", slang:"#f87171", literary:"#c084fc", colloquial:"#fb923c", business:"#38bdf8", academic:"#818cf8", neutral:"#94a3b8" };

function uid()   { return Math.random().toString(36).substr(2, 9); }
function chips(text, color) {
  if (!text) return null;
  return text.split(",").map(t => t.trim()).filter(Boolean).map((t, i) => (
    <span key={i} style={{ display:"inline-block", background:color+"22", color, border:`1px solid ${color}44`, borderRadius:20, padding:"2px 10px", fontSize:12, margin:"2px 3px 2px 0", fontFamily:"Georgia,serif" }}>{t}</span>
  ));
}

/* ════════════════════════════════════════════════════════
   STORAGE — localStorage + /src/backup/ GitHub fallback
   
   Estratégia de carregamento (3 camadas):
   1. localStorage — dados locais do navegador atual
   2. /src/backup/words.json e /src/backup/phrases.json — arquivos no repo
   3. Objeto vazio — sem dados ainda
   
   O localStorage SEMPRE tem prioridade sobre os arquivos JSON.
   Quando o fallback é usado, os dados são salvos no localStorage
   para que edições futuras persistam normalmente.
════════════════════════════════════════════════════════ */

/* Caminhos dos arquivos JSON no repositório */
const BACKUP_WORDS_URL   = "/src/backup/words.json";
const BACKUP_PHRASES_URL = "/src/backup/phrases.json";

async function sGet(key) {
  try { const v = localStorage.getItem(key); if (v) return JSON.parse(v); } catch { }
  return null;
}
async function sSet(key, data) {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch (e) { console.error(e); }
}

/* Carrega dados de uma chave, com fallback para arquivo JSON remoto */
async function sGetWithFallback(key, fallbackUrl) {
  // 1. Tentar localStorage primeiro
  try {
    const v = localStorage.getItem(key);
    if (v) return JSON.parse(v);
  } catch { }

  // 2. Tentar buscar o arquivo JSON do repositório
  try {
    const res = await fetch(fallbackUrl, { cache: "no-store" });
    if (res.ok) {
      const json = await res.json();
      // O arquivo pode ser { data: {...} } ou diretamente { A:[...], B:[...] }
      const data = json.data || json;
      // Salvar no localStorage para próximas visitas neste navegador
      localStorage.setItem(key, JSON.stringify(data));
      console.log(`[English VIBE] Carregado de ${fallbackUrl} e salvo no localStorage`);
      return data;
    }
  } catch (e) {
    console.warn(`[English VIBE] Fallback ${fallbackUrl} não disponível:`, e.message);
  }

  // 3. Sem dados — app começa vazio
  return null;
}

/* ════════════════════════════════════════════════════════
   SHARED BADGES
════════════════════════════════════════════════════════ */
function DiffBadge({ level }) {
  if (!level) return null;
  const c = DIFF_COLORS[level] || "#999";
  return <span style={{ fontSize:10, fontWeight:700, letterSpacing:1, color:c, background:c+"22", borderRadius:4, padding:"2px 6px", textTransform:"uppercase" }}>{level}</span>;
}
function TypeBadge({ type }) {
  if (!type) return null;
  return <span style={{ fontSize:10, fontWeight:600, letterSpacing:0.5, color:"#7dd3fc", background:"#0ea5e922", borderRadius:4, padding:"2px 6px", textTransform:"uppercase" }}>{type}</span>;
}
function RegBadge({ register }) {
  if (!register) return null;
  const c = REG_COLORS[register] || "#94a3b8";
  return <span style={{ fontSize:10, fontWeight:600, letterSpacing:0.5, color:c, background:c+"22", borderRadius:4, padding:"2px 6px", textTransform:"uppercase" }}>{register}</span>;
}
function PendingDash({ label }) {
  return <span style={{ fontSize:10, color:"#475569", background:"#ffffff06", border:"1px dashed #ffffff18", borderRadius:4, padding:"2px 6px" }}>{label} —</span>;
}

/* ════════════════════════════════════════════════════════
   SHARED THUMB BAR
════════════════════════════════════════════════════════ */
function ThumbBar({ dataByLetter, activeLetter, setActiveLetter, resetFilters, accentColor, thumbActiveExtra }) {
  const scrollRef    = useRef(null);
  const [hoveredLetter, setHoveredLetter] = useState(null);
  const [canScrollL, setCanScrollL] = useState(false);
  const [canScrollR, setCanScrollR] = useState(false);

  // Scroll active letter into view on letter change
  useEffect(() => {
    const btn = scrollRef.current?.querySelector(`[data-letter="${activeLetter}"]`);
    if (btn) btn.scrollIntoView({ behavior:"smooth", inline:"center", block:"nearest" });
  }, [activeLetter]);

  // Detect overflow on mount, resize and scroll
  function checkScroll() {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollL(el.scrollLeft > 4);
    setCanScrollR(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener("scroll", checkScroll, { passive: true });
    const ro = new ResizeObserver(checkScroll);
    ro.observe(el);
    return () => { el.removeEventListener("scroll", checkScroll); ro.disconnect(); };
  }, []);

  function scroll(dir) {
    const el = scrollRef.current;
    if (!el) return;
    // Scroll by roughly 5 letter buttons
    el.scrollBy({ left: dir * 240, behavior: "smooth" });
  }

  const arrowStyle = (visible, side) => ({
    position: "absolute",
    top: 0, bottom: 0,
    [side]: 0,
    width: 36,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: side === "left"
      ? "linear-gradient(to right, #0d1220 60%, transparent)"
      : "linear-gradient(to left,  #0d1220 60%, transparent)",
    zIndex: 20,
    cursor: "pointer",
    opacity: visible ? 1 : 0,
    pointerEvents: visible ? "auto" : "none",
    transition: "opacity 0.2s ease",
    border: "none",
    padding: 0,
  });

  const arrowIconStyle = (accent) => ({
    width: 24, height: 24,
    borderRadius: "50%",
    background: accent + "22",
    border: `1px solid ${accent}55`,
    color: accent,
    fontSize: 14,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 900,
    transition: "all 0.15s",
  });

  return (
    <div style={{ position:"relative", background:"#0d1220", borderBottom:"1px solid #ffffff08", zIndex:10 }}>
      {/* Left arrow */}
      <button
        style={arrowStyle(canScrollL, "left")}
        onClick={() => scroll(-1)}
        onMouseEnter={e => { const ic = e.currentTarget.querySelector("span"); if (ic) { ic.style.background = accentColor + "44"; ic.style.boxShadow = `0 0 8px ${accentColor}66`; }}}
        onMouseLeave={e => { const ic = e.currentTarget.querySelector("span"); if (ic) { ic.style.background = accentColor + "22"; ic.style.boxShadow = "none"; }}}
        aria-label="Rolar para esquerda"
      >
        <span style={arrowIconStyle(accentColor)}>‹</span>
      </button>

      {/* Scrollable track */}
      <div ref={scrollRef} style={{ display:"flex", gap:4, overflowX:"auto", padding:"10px 14px", scrollbarWidth:"none", WebkitOverflowScrolling:"touch" }}>
        {ALPHABET.map(letter => {
          const count   = (dataByLetter[letter] || []).length;
          const pending = (dataByLetter[letter] || []).filter(x => x._pending).length;
          const active  = letter === activeLetter;
          const hovered = hoveredLetter === letter && !active;

          let btnStyle = {
            minWidth:40, height:50, borderRadius:9, flexShrink:0,
            fontFamily:"Georgia,serif", cursor:"pointer",
            display:"flex", flexDirection:"column",
            alignItems:"center", justifyContent:"center",
            gap:1, position:"relative",
            transition:"all 0.18s ease",
          };
          let letterColor;

          if (active) {
            btnStyle = { ...btnStyle,
              background: accentColor,
              color: "#0f172a",
              border: `1px solid ${accentColor}`,
              boxShadow: `0 0 18px ${accentColor}88`,
              transform: "scale(1.08)",
              ...thumbActiveExtra,
            };
            letterColor = "#0f172a";
          } else if (hovered) {
            btnStyle = { ...btnStyle,
              background: accentColor + "28",
              color: accentColor,
              border: `1px solid ${accentColor}99`,
              boxShadow: `0 0 12px ${accentColor}44`,
              transform: "scale(1.12) translateY(-2px)",
            };
            letterColor = accentColor;
          } else if (count > 0) {
            btnStyle = { ...btnStyle,
              background: "#1e3a5f",
              color: accentColor,
              border: `1px solid ${accentColor}44`,
            };
            letterColor = accentColor;
          } else {
            btnStyle = { ...btnStyle,
              background: "#ffffff07",
              color: "#64748b",
              border: "1px solid #ffffff0f",
            };
            letterColor = "#64748b";
          }

          return (
            <button key={letter} data-letter={letter}
              style={btnStyle}
              onClick={() => { setActiveLetter(letter); resetFilters(); }}
              onMouseEnter={() => setHoveredLetter(letter)}
              onMouseLeave={() => setHoveredLetter(null)}
            >
              <span style={{
                fontSize: active ? 18 : hovered ? 17 : 15,
                fontWeight: active || hovered ? 900 : 600,
                lineHeight: 1,
                color: letterColor,
                transition: "all 0.18s ease",
                textShadow: hovered ? `0 0 8px ${accentColor}` : "none",
              }}>{letter}</span>
              {count > 0 && (
                <span style={{
                  fontSize: 9, fontWeight: 700, lineHeight: 1, marginTop: 1,
                  color: active ? "#0f172a" : accentColor,
                  transition: "color 0.18s ease",
                }}>{count}</span>
              )}
              {pending > 0 && !active && (
                <span style={{
                  position:"absolute", top:4, right:4,
                  width:7, height:7, borderRadius:"50%",
                  background:"#f59e0b", boxShadow:"0 0 5px #f59e0b",
                }} />
              )}
            </button>
          );
        })}
      </div>

      {/* Right arrow */}
      <button
        style={arrowStyle(canScrollR, "right")}
        onClick={() => scroll(1)}
        onMouseEnter={e => { const ic = e.currentTarget.querySelector("span"); if (ic) { ic.style.background = accentColor + "44"; ic.style.boxShadow = `0 0 8px ${accentColor}66`; }}}
        onMouseLeave={e => { const ic = e.currentTarget.querySelector("span"); if (ic) { ic.style.background = accentColor + "22"; ic.style.boxShadow = "none"; }}}
        aria-label="Rolar para direita"
      >
        <span style={arrowIconStyle(accentColor)}>›</span>
      </button>
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   SHARED BULK IMPORT — words mode vs phrases mode
════════════════════════════════════════════════════════ */
function BulkImportPanel({ mode, onImport, onClose }) {
  const isPhrase = mode === "phrases";
  const [raw, setRaw]         = useState("");
  const [preview, setPreview] = useState([]);
  const [error, setError]     = useState("");
  const [done, setDone]       = useState(false);
  const taRef = useRef(null);
  useEffect(() => { taRef.current?.focus(); }, []);

  // Parse raw text into groups. Each line (or comma/semicolon-separated entry
  // for words) may contain "/" to indicate variants within a single card.
  // e.g. "Only / Just / Never" → { main: "Only", variants: ["Just","Never"] }
  function parseGroups(text) {
    const sep = isPhrase ? /[\n;]+/ : /[\n,;]+/;
    return text
      .split(sep)
      .map(entry => entry.trim())
      .filter(entry => entry.length > 0 && /[a-zA-Z]/.test(entry))
      .map(entry => {
        const parts = entry.split("/").map(p => p.trim()).filter(p => p.length > 0);
        return { main: parts[0], variants: parts.slice(1) };
      });
  }

  function handleChange(val) {
    setRaw(val); setError(""); setDone(false);
    setPreview(parseGroups(val));
  }

  function handleImport() {
    if (!preview.length) { setError(`Nenhuma ${isPhrase?"frase":"palavra"} válida encontrada.`); return; }
    const grouped = {};
    preview.forEach(({ main, variants }) => {
      const letter = main[0].toUpperCase();
      if (!ALPHABET.includes(letter)) return;
      if (!grouped[letter]) grouped[letter] = [];
      const base = {
        id: uid(), translation:"", pronunciation:"", notes:"", tags:"",
        imageUrl:"", audioNote:"", difficulty:"", _pending: true,
        variants: variants, // store sibling variants
      };
      grouped[letter].push(isPhrase
        ? { ...base, phrase: main, literal:"", context:"", register:"", structure:"", synonymPhrases:"", antonymPhrases:"", example:"" }
        : { ...base, term: main, synonyms:"", antonyms:"", definition:"", example:"", type:"" }
      );
    });
    onImport(grouped);
    setDone(true); setRaw(""); setPreview([]);
  }

  // Build byLetter from preview groups
  const byLetter = {};
  preview.forEach(({ main, variants }) => {
    const l = main[0].toUpperCase();
    if (!byLetter[l]) byLetter[l] = [];
    byLetter[l].push({ main, variants });
  });

  const accent = isPhrase ? "#a855f7" : "#0ea5e9";
  const totalItems = preview.length;

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={{ ...S.modal, maxWidth:700 }} onClick={e => e.stopPropagation()}>
        <div style={S.modalHeader}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <span style={{ fontSize:22 }}>⚡</span>
            <div>
              <div style={S.modalTitle}>Importação Rápida — {isPhrase ? "Frases" : "Palavras"}</div>
              <div style={{ fontSize:11, color:"#475569", marginTop:1 }}>
                {isPhrase
                  ? "Enter ou ; para separar · / para agrupar variantes no mesmo card"
                  : "Enter, vírgula ou ; para separar · / para agrupar variantes no mesmo card"}
              </div>
            </div>
          </div>
          <button style={S.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div style={S.modalBody}>
          {/* Tips */}
          <div style={{ background:`${accent}11`, border:`1px solid ${accent}33`, borderRadius:10, padding:"12px 16px", display:"flex", gap:14, flexWrap:"wrap" }}>
            {(isPhrase ? [
              ["Uma por linha",       "Break a leg\nHit the nail on the head"],
              ["Por ponto e vírgula", "Actions speak louder; The ball is in your court"],
              ["⚠️ Vírgulas preservadas", "\"To be, or not to be\"\nfica como uma frase só"],
              ["🔗 Agrupar com /",    "Rise / Fall / Drop\n→ 1 card, hover revela variantes"],
            ] : [
              ["Uma por linha",       "apple\nbe on time\ncastle"],
              ["Por vírgula",         "dog, working directly, fly"],
              ["Por ponto e vírgula", "grow; set up; iron"],
              ["🔗 Agrupar com /",    "Only / Just / Never / Ready\n→ 1 card, hover revela variantes"],
            ]).map(([label, ex]) => (
              <div key={label} style={{ flex:"1 1 130px" }}>
                <div style={{ fontSize:11, color: label.startsWith("⚠️") ? "#f59e0b" : label.startsWith("🔗") ? "#34d399" : accent, fontWeight:700, marginBottom:3 }}>{label}</div>
                <code style={{ fontSize:11, color:"#94a3b8", whiteSpace:"pre" }}>{ex}</code>
              </div>
            ))}
          </div>

          <div style={S.fieldGroup}>
            <label style={S.label}>Cole {isPhrase ? "suas frases" : "suas palavras"} aqui</label>
            <textarea ref={taRef}
              style={{ ...S.input, height:170, resize:"vertical", fontFamily:"monospace", fontSize:14, lineHeight:1.7 }}
              placeholder={isPhrase
                ? "Break a leg\nHit the nail on the head\nRise / Fall / Drop\nActions speak louder..."
                : "apple\nOnly / Just / Never / Ready\ndog, working directly\ngrow; happy..."}
              value={raw} onChange={e => handleChange(e.target.value)} />
          </div>

          {error && <div style={{ color:"#f87171", fontSize:13, padding:"6px 10px", background:"#f8717111", borderRadius:8 }}>⚠️ {error}</div>}
          {done  && <div style={{ color:"#34d399", fontSize:13, padding:"8px 12px", background:"#34d39911", borderRadius:8, fontWeight:600 }}>✓ Importado! Passe o mouse nos cards com variantes para vê-las. Clique para completar os dados.</div>}

          {preview.length > 0 && (
            <div>
              <div style={{ ...S.label, marginBottom:10 }}>
                Prévia — {totalItems} {isPhrase?"frase":"palavra"}{totalItems!==1?"s":""}
                {preview.some(g => g.variants.length > 0) && (
                  <span style={{ color:"#34d399", marginLeft:8, fontWeight:600 }}>
                    · {preview.filter(g=>g.variants.length>0).length} com variantes
                  </span>
                )}
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:8, maxHeight:210, overflowY:"auto" }}>
                {Object.entries(byLetter).sort().map(([letter, groups]) => (
                  <div key={letter} style={{ display:"flex", alignItems:"flex-start", gap:10 }}>
                    <div style={{ width:28, height:28, borderRadius:8, flexShrink:0, background:`${accent}22`, border:`1px solid ${accent}44`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:900, color:accent, fontFamily:"Georgia,serif" }}>{letter}</div>
                    <div style={{ flex:1, display:"flex", flexDirection: isPhrase ? "column" : "row", flexWrap: isPhrase ? undefined : "wrap", gap:5, paddingTop:3 }}>
                      {groups.map(({ main, variants }, i) => (
                        <span key={i} style={{ display:"inline-flex", alignItems:"center", gap:5, background:"#ffffff0a", border: variants.length > 0 ? "1px solid #34d39944" : "1px solid #ffffff14", borderRadius: isPhrase ? 8 : 20, padding: isPhrase ? "4px 12px" : "3px 10px", fontSize:13, color:"#e2e8f0", fontFamily:"Georgia,serif", fontStyle: isPhrase ? "italic" : "normal" }}>
                          {isPhrase ? `"${main}"` : main}
                          {variants.length > 0 && (
                            <span style={{ fontSize:10, color:"#34d399", background:"#34d39922", borderRadius:10, padding:"1px 6px", fontStyle:"normal", fontFamily:"sans-serif" }}>
                              +{variants.length}
                            </span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={S.modalFooter}>
          <button style={S.cancelBtn} onClick={onClose}>Fechar</button>
          <button
            style={{ ...S.saveBtn, opacity: preview.length===0 ? 0.4 : 1, background:`linear-gradient(135deg, ${isPhrase?"#7c3aed, #a855f7":"#059669, #0ea5e9"})` }}
            onClick={handleImport} disabled={preview.length===0}>
            ⚡ Importar {preview.length > 0 ? `${preview.length} ${isPhrase?"frases":"palavras"}` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   VARIANTS EDITOR — shared by Word and Phrase modals
════════════════════════════════════════════════════════ */
function VariantsEditor({ variants = [], onChange, accentColor = "#7dd3fc", placeholder = "Nova variante..." }) {
  const [inputVal, setInputVal] = useState("");
  const inputRef = useRef(null);

  function addVariant() {
    const v = inputVal.trim();
    if (!v) return;
    onChange([...variants, v]);
    setInputVal("");
    inputRef.current?.focus();
  }

  function removeVariant(i) {
    onChange(variants.filter((_, idx) => idx !== i));
  }

  function editVariant(i, val) {
    const updated = [...variants];
    updated[i] = val;
    onChange(updated);
  }

  function handleKeyDown(e) {
    if (e.key === "Enter") { e.preventDefault(); addVariant(); }
  }

  const dimAccent = accentColor + "22";
  const borderAccent = accentColor + "55";

  return (
    <div style={S.fieldGroup}>
      <label style={S.label}>
        🔗 Variantes
        {variants.length > 0 && (
          <span style={{ marginLeft:8, fontSize:10, color:accentColor, background:dimAccent, border:`1px solid ${borderAccent}`, borderRadius:10, padding:"1px 8px", fontWeight:700 }}>
            {variants.length} adicionada{variants.length > 1 ? "s" : ""}
          </span>
        )}
      </label>

      {/* Existing variants list */}
      {variants.length > 0 && (
        <div style={{ display:"flex", flexDirection:"column", gap:5, marginBottom:8 }}>
          {variants.map((v, i) => (
            <div key={i} style={{ display:"flex", alignItems:"center", gap:6 }}>
              {/* Drag handle visual */}
              <span style={{ fontSize:12, color:"#334155", cursor:"default", userSelect:"none", flexShrink:0 }}>⠿</span>
              <input
                style={{
                  ...S.input, flex:1,
                  borderColor: accentColor + "44",
                  color: accentColor,
                  fontWeight:600, fontSize:14,
                  fontFamily:"Georgia,serif",
                }}
                value={v}
                onChange={e => editVariant(i, e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") e.preventDefault(); }}
              />
              <button
                style={{
                  width:28, height:28, borderRadius:7, flexShrink:0,
                  background:"#f8717115", border:"1px solid #f8717133",
                  color:"#f87171", fontSize:13, cursor:"pointer",
                  display:"flex", alignItems:"center", justifyContent:"center",
                }}
                onClick={() => removeVariant(i)}
                title="Remover variante"
              >✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Add new variant input */}
      <div style={{ display:"flex", gap:6 }}>
        <input
          ref={inputRef}
          style={{ ...S.input, flex:1 }}
          placeholder={placeholder}
          value={inputVal}
          onChange={e => setInputVal(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button
          style={{
            padding:"9px 16px", borderRadius:8, flexShrink:0,
            background: inputVal.trim() ? `linear-gradient(135deg, ${accentColor}44, ${accentColor}22)` : "#ffffff08",
            border: `1px solid ${inputVal.trim() ? accentColor + "66" : "#ffffff14"}`,
            color: inputVal.trim() ? accentColor : "#475569",
            fontSize:13, fontWeight:700, cursor: inputVal.trim() ? "pointer" : "default",
            transition:"all 0.15s",
          }}
          onClick={addVariant}
          disabled={!inputVal.trim()}
        >
          + Adicionar
        </button>
      </div>
      <div style={{ fontSize:10, color:"#334155", marginTop:4 }}>
        Pressione Enter para adicionar rapidamente · clique em ✕ para remover
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   WORD MODAL
════════════════════════════════════════════════════════ */
function WordModal({ word, onClose, onSave }) {
  const [form, setForm] = useState(word || { id:uid(), term:"", translation:"", pronunciation:"", synonyms:"", antonyms:"", definition:"", example:"", notes:"", type:"", difficulty:"", tags:"", imageUrl:"", audioNote:"", variants:[] });
  const hc = (f, v) => setForm(p => ({ ...p, [f]: v }));
  function submit() { if (!form.term.trim()) return; onSave({ ...form, term:form.term.trim(), _pending:false }); }
  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>
        <div style={S.modalHeader}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            {word?._pending && <span style={{ fontSize:10, fontWeight:700, letterSpacing:1, color:"#f59e0b", background:"#f59e0b22", border:"1px solid #f59e0b44", borderRadius:4, padding:"3px 8px" }}>PENDENTE</span>}
            <span style={S.modalTitle}>{word ? "✏️ Editar Palavra" : "✦ Nova Palavra"}</span>
          </div>
          <button style={S.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div style={S.modalBody}>
          <div style={S.fieldGroup}><label style={S.label}>Palavra *</label><input style={S.input} placeholder="Digite a palavra..." value={form.term} onChange={e=>hc("term",e.target.value)} autoFocus /></div>
          <div style={S.row2}>
            <div style={S.fieldGroup}><label style={S.label}>Tradução</label><input style={S.input} placeholder="Tradução..." value={form.translation} onChange={e=>hc("translation",e.target.value)} /></div>
            <div style={S.fieldGroup}><label style={S.label}>Pronúncia</label><input style={S.input} placeholder="/prəˌnʌnsiˈeɪʃən/" value={form.pronunciation} onChange={e=>hc("pronunciation",e.target.value)} /></div>
          </div>
          <div style={S.row2}>
            <div style={S.fieldGroup}><label style={S.label}>Tipo</label>
              <select style={S.select} value={form.type} onChange={e=>hc("type",e.target.value)}>
                <option value="">— selecionar —</option>
                {["noun","verb","adjective","adverb","pronoun","preposition","conjunction","interjection","phrase"].map(t=><option key={t} value={t}>{t[0].toUpperCase()+t.slice(1)}</option>)}
              </select>
            </div>
            <div style={S.fieldGroup}><label style={S.label}>Dificuldade</label>
              <select style={S.select} value={form.difficulty} onChange={e=>hc("difficulty",e.target.value)}>
                <option value="">— selecionar —</option>
                {["easy","medium","hard","expert"].map(d=><option key={d} value={d}>{d[0].toUpperCase()+d.slice(1)}</option>)}
              </select>
            </div>
          </div>
          <div style={S.row2}>
            <div style={S.fieldGroup}><label style={S.label}>Sinônimos</label><input style={S.input} placeholder="Separados por vírgula..." value={form.synonyms} onChange={e=>hc("synonyms",e.target.value)} /></div>
            <div style={S.fieldGroup}><label style={S.label}>Antônimos</label><input style={S.input} placeholder="Separados por vírgula..." value={form.antonyms} onChange={e=>hc("antonyms",e.target.value)} /></div>
          </div>
          <div style={S.fieldGroup}><label style={S.label}>Definição</label><textarea style={{...S.input,height:64,resize:"vertical"}} placeholder="Definição da palavra..." value={form.definition} onChange={e=>hc("definition",e.target.value)} /></div>
          <div style={S.fieldGroup}><label style={S.label}>Exemplo de uso</label><textarea style={{...S.input,height:56,resize:"vertical"}} placeholder="Use em uma frase..." value={form.example} onChange={e=>hc("example",e.target.value)} /></div>
          <div style={S.row2}>
            <div style={S.fieldGroup}><label style={S.label}>🖼️ URL da Imagem</label><input style={S.input} placeholder="https://..." value={form.imageUrl} onChange={e=>hc("imageUrl",e.target.value)} /></div>
            <div style={S.fieldGroup}><label style={S.label}>Tags</label><input style={S.input} placeholder="idiom, formal, slang..." value={form.tags} onChange={e=>hc("tags",e.target.value)} /></div>
          </div>
          <div style={S.fieldGroup}><label style={S.label}>📝 Notas pessoais</label><textarea style={{...S.input,height:56,resize:"vertical"}} placeholder="Anotações, contexto..." value={form.notes} onChange={e=>hc("notes",e.target.value)} /></div>
          <div style={S.fieldGroup}><label style={S.label}>🔊 Nota de áudio</label><input style={S.input} placeholder="Texto que será lido em voz alta..." value={form.audioNote} onChange={e=>hc("audioNote",e.target.value)} /></div>

          {/* ── VARIANTS EDITOR ── */}
          <div style={{ borderTop:"1px solid #ffffff0a", paddingTop:14, marginTop:2 }}>
            <VariantsEditor
              variants={form.variants || []}
              onChange={v => hc("variants", v)}
              accentColor="#7dd3fc"
              placeholder="Ex: Just, Never, Ready..."
            />
          </div>
        </div>
        <div style={S.modalFooter}>
          <button style={S.cancelBtn} onClick={onClose}>Cancelar</button>
          <button style={S.saveBtn} onClick={submit}>{word ? "💾 Salvar alterações" : "✦ Adicionar"}</button>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   PHRASE MODAL
════════════════════════════════════════════════════════ */
function PhraseModal({ phrase, onClose, onSave }) {
  const [form, setForm] = useState(phrase || { id:uid(), phrase:"", translation:"", literal:"", pronunciation:"", context:"", register:"", structure:"", synonymPhrases:"", antonymPhrases:"", example:"", notes:"", tags:"", imageUrl:"", audioNote:"", difficulty:"", variants:[] });
  const hc = (f, v) => setForm(p => ({ ...p, [f]: v }));
  function submit() { if (!form.phrase.trim()) return; onSave({ ...form, phrase:form.phrase.trim(), _pending:false }); }
  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>
        <div style={S.modalHeader}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            {phrase?._pending && <span style={{ fontSize:10, fontWeight:700, letterSpacing:1, color:"#f59e0b", background:"#f59e0b22", border:"1px solid #f59e0b44", borderRadius:4, padding:"3px 8px" }}>PENDENTE</span>}
            <span style={S.modalTitle}>{phrase ? "✏️ Editar Frase" : "✦ Nova Frase"}</span>
          </div>
          <button style={S.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div style={S.modalBody}>
          <div style={S.fieldGroup}><label style={S.label}>Frase *</label><textarea style={{...S.input,height:72,resize:"vertical",fontSize:15,fontStyle:"italic"}} placeholder="Digite ou cole a frase completa..." value={form.phrase} onChange={e=>hc("phrase",e.target.value)} autoFocus /></div>
          <div style={S.row2}>
            <div style={S.fieldGroup}><label style={S.label}>🌐 Tradução</label><input style={S.input} placeholder="Tradução em português..." value={form.translation} onChange={e=>hc("translation",e.target.value)} /></div>
            <div style={S.fieldGroup}><label style={S.label}>🔤 Tradução literal</label><input style={S.input} placeholder="Palavra por palavra..." value={form.literal} onChange={e=>hc("literal",e.target.value)} /></div>
          </div>
          <div style={S.row2}>
            <div style={S.fieldGroup}><label style={S.label}>🔊 Pronúncia / Ritmo</label><input style={S.input} placeholder="/ɪts ˈreɪnɪŋ kæts ənd dɒɡz/" value={form.pronunciation} onChange={e=>hc("pronunciation",e.target.value)} /></div>
            <div style={S.fieldGroup}><label style={S.label}>Dificuldade</label>
              <select style={S.select} value={form.difficulty} onChange={e=>hc("difficulty",e.target.value)}>
                <option value="">— selecionar —</option>
                {["easy","medium","hard","expert"].map(d=><option key={d} value={d}>{d[0].toUpperCase()+d.slice(1)}</option>)}
              </select>
            </div>
          </div>
          <div style={S.row2}>
            <div style={S.fieldGroup}><label style={S.label}>🎭 Registro / Tom</label>
              <select style={S.select} value={form.register} onChange={e=>hc("register",e.target.value)}>
                <option value="">— selecionar —</option>
                {["formal","informal","neutral","slang","literary","colloquial","business","academic"].map(r=><option key={r} value={r}>{r[0].toUpperCase()+r.slice(1)}</option>)}
              </select>
            </div>
            <div style={S.fieldGroup}><label style={S.label}>📐 Estrutura gramatical</label><input style={S.input} placeholder="idiom, proverb, phrasal verb..." value={form.structure} onChange={e=>hc("structure",e.target.value)} /></div>
          </div>
          <div style={S.fieldGroup}><label style={S.label}>💡 Contexto de uso</label><textarea style={{...S.input,height:64,resize:"vertical"}} placeholder="Quando, onde e como usar..." value={form.context} onChange={e=>hc("context",e.target.value)} /></div>
          <div style={S.fieldGroup}><label style={S.label}>💬 Exemplo em contexto</label><textarea style={{...S.input,height:56,resize:"vertical"}} placeholder="Use a frase em uma situação real..." value={form.example} onChange={e=>hc("example",e.target.value)} /></div>
          <div style={S.row2}>
            <div style={S.fieldGroup}><label style={S.label}>≈ Frases sinônimas</label><input style={S.input} placeholder="Frases similares separadas por vírgula..." value={form.synonymPhrases} onChange={e=>hc("synonymPhrases",e.target.value)} /></div>
            <div style={S.fieldGroup}><label style={S.label}>≠ Frases antônimas</label><input style={S.input} placeholder="Frases de sentido oposto..." value={form.antonymPhrases} onChange={e=>hc("antonymPhrases",e.target.value)} /></div>
          </div>
          <div style={S.row2}>
            <div style={S.fieldGroup}><label style={S.label}>Tags</label><input style={S.input} placeholder="idiom, encouragement..." value={form.tags} onChange={e=>hc("tags",e.target.value)} /></div>
            <div style={S.fieldGroup}><label style={S.label}>🖼️ URL da Imagem</label><input style={S.input} placeholder="https://..." value={form.imageUrl} onChange={e=>hc("imageUrl",e.target.value)} /></div>
          </div>
          <div style={S.fieldGroup}><label style={S.label}>📝 Notas pessoais</label><textarea style={{...S.input,height:56,resize:"vertical"}} placeholder="Memórias, truques, associações..." value={form.notes} onChange={e=>hc("notes",e.target.value)} /></div>
          <div style={S.fieldGroup}><label style={S.label}>🔊 Nota de áudio</label><input style={S.input} placeholder="Texto que será lido em voz alta..." value={form.audioNote} onChange={e=>hc("audioNote",e.target.value)} /></div>

          {/* ── VARIANTS EDITOR ── */}
          <div style={{ borderTop:"1px solid #ffffff0a", paddingTop:14, marginTop:2 }}>
            <VariantsEditor
              variants={form.variants || []}
              onChange={v => hc("variants", v)}
              accentColor="#c084fc"
              placeholder="Ex: Rise and fall, Give and take..."
            />
          </div>
        </div>
        <div style={S.modalFooter}>
          <button style={S.cancelBtn} onClick={onClose}>Cancelar</button>
          <button style={{ ...S.saveBtn, background:"linear-gradient(135deg,#7c3aed,#a855f7)" }} onClick={submit}>{phrase ? "💾 Salvar alterações" : "✦ Adicionar"}</button>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   WORD CARD
════════════════════════════════════════════════════════ */
function WordCard({ word, index, onEdit, onDelete, onSpeak }) {
  const ip       = !!word._pending;
  const bg       = CARD_COLORS[index % CARD_COLORS.length];
  const variants = word.variants || [];
  const [hovered, setHovered] = useState(false);

  return (
    <div
      style={{ background:bg, border:ip?"1px solid #f59e0b55":"1px solid #ffffff14", borderRadius:16, marginBottom:14, overflow:"hidden", boxShadow:ip?"0 4px 20px #f59e0b18":"0 4px 24px #00000040", transition:"transform 0.15s,box-shadow 0.15s", cursor:ip?"pointer":"default" }}
      onClick={ip?()=>onEdit(word):undefined}
      onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow=ip?"0 8px 28px #f59e0b28":"0 8px 32px #00000060"; setHovered(true);}}
      onMouseLeave={e=>{e.currentTarget.style.transform="";e.currentTarget.style.boxShadow=ip?"0 4px 20px #f59e0b18":"0 4px 24px #00000040"; setHovered(false);}}>

      {ip && <div style={{ background:"linear-gradient(90deg,#f59e0b22,#f59e0b06)", borderBottom:"1px solid #f59e0b2a", padding:"5px 18px", display:"flex", alignItems:"center", gap:8 }}><span>⏳</span><span style={{ fontSize:11, color:"#f59e0b", fontWeight:700, letterSpacing:0.5 }}>CLIQUE PARA COMPLETAR OS DADOS</span></div>}

      <div style={{ display:"flex", alignItems:"flex-start", gap:12, padding:"14px 18px 0" }}>
        <div style={{ width:34, height:34, borderRadius:9, flexShrink:0, background:ip?"#f59e0b1a":"#ffffff18", border:ip?"1px solid #f59e0b33":"none", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:800, color:ip?"#f59e0b":"#fff", marginTop:2 }}>{index+1}</div>
        <div style={{ flex:1, minWidth:0 }}>
          {/* Main term */}
          <div style={{ display:"flex", alignItems:"baseline", gap:10, flexWrap:"wrap" }}>
            <span style={{ fontSize:20, fontWeight:900, color:"#fff", fontFamily:"Georgia,serif", letterSpacing:-0.5 }}>{word.term}</span>
            {word.pronunciation && <span style={{ fontSize:13, color:"#94a3b8", fontStyle:"italic" }}>{word.pronunciation}</span>}
            {(word._dupCount > 1) && (
              <span style={{
                display:"inline-flex", alignItems:"center", gap:4,
                fontSize:10, fontWeight:700, letterSpacing:0.5,
                color:"#fb923c", background:"#fb923c15",
                border:"1px solid #fb923c44",
                borderRadius:20, padding:"2px 9px",
              }} title={`Esta palavra foi adicionada ${word._dupCount} vezes — duplicatas removidas automaticamente`}>
                ✕{word._dupCount - 1} duplicata{word._dupCount - 1 !== 1 ? "s" : ""} removida{word._dupCount - 1 !== 1 ? "s" : ""}
              </span>
            )}
            {variants.length > 0 && !hovered && (
              <span style={{ fontSize:10, color:"#34d399", background:"#34d39918", border:"1px solid #34d39933", borderRadius:10, padding:"2px 8px", cursor:"default" }}>
                +{variants.length} variante{variants.length>1?"s":""} · passe o mouse
              </span>
            )}
          </div>

          {/* Variants — slide down on hover */}
          {variants.length > 0 && (
            <div style={{
              display:"flex", flexWrap:"wrap", gap:6, marginTop: hovered ? 8 : 0,
              maxHeight: hovered ? 120 : 0,
              opacity: hovered ? 1 : 0,
              overflow:"hidden",
              transition:"max-height 0.28s ease, opacity 0.22s ease, margin-top 0.22s ease",
            }}>
              {variants.map((v, i) => (
                <span key={i} style={{
                  fontSize:15, fontWeight:700, color:"#7dd3fc",
                  background:"#7dd3fc14", border:"1px solid #7dd3fc33",
                  borderRadius:20, padding:"4px 14px",
                  fontFamily:"Georgia,serif", letterSpacing:-0.3,
                  boxShadow:"0 0 8px #7dd3fc18",
                  transition:"transform 0.15s",
                }}>{v}</span>
              ))}
            </div>
          )}

          <div style={{ display:"flex", gap:5, marginTop:6, flexWrap:"wrap", alignItems:"center" }}>
            {word.type      ? <TypeBadge type={word.type} />          : ip && <PendingDash label="tipo" />}
            {word.difficulty? <DiffBadge level={word.difficulty} />   : ip && <PendingDash label="dificuldade" />}
            {word.tags && word.tags.split(",").map((t,i)=><span key={i} style={{ fontSize:10, color:"#f59e0b", background:"#f59e0b11", border:"1px solid #f59e0b33", borderRadius:4, padding:"2px 6px" }}>#{t.trim()}</span>)}
          </div>
        </div>
        <div style={{ display:"flex", gap:4, flexShrink:0 }} onClick={e=>e.stopPropagation()}>
          {!ip && <button style={S.iconBtn} onClick={()=>onSpeak(word)}>🔊</button>}
          <button style={S.iconBtn} onClick={()=>onEdit(word)}>✏️</button>
          <button style={{...S.iconBtn,opacity:0.5}} onClick={()=>onDelete(word.id)}>🗑</button>
        </div>
      </div>

      {!ip && (
        <div style={{ padding:"12px 18px 16px", display:"flex", flexDirection:"column", gap:10 }}>
          {word.translation && <div style={S.infoRow}><span style={S.infoIcon}>🌐</span><span style={S.infoKey}>Tradução</span><span style={{...S.infoVal,color:"#7dd3fc",fontWeight:600}}>{word.translation}</span></div>}
          {word.definition  && <div style={S.infoBlock}><span style={S.infoKeyB}>📖 Definição</span><span style={S.infoValB}>{word.definition}</span></div>}
          {word.example     && <div style={S.infoBlock}><span style={S.infoKeyB}>💬 Exemplo</span><span style={{...S.infoValB,fontStyle:"italic",color:"#a5f3fc"}}>"{word.example}"</span></div>}
          {(word.synonyms||word.antonyms) && (
            <div style={{ display:"grid", gridTemplateColumns:word.synonyms&&word.antonyms?"1fr 1fr":"1fr", gap:10 }}>
              {word.synonyms && <div style={S.infoBlock}><span style={S.infoKeyB}>≈ Sinônimos</span><div>{chips(word.synonyms,"#34d399")}</div></div>}
              {word.antonyms && <div style={S.infoBlock}><span style={S.infoKeyB}>≠ Antônimos</span><div>{chips(word.antonyms,"#f87171")}</div></div>}
            </div>
          )}
          {word.notes     && <div style={S.infoBlock}><span style={S.infoKeyB}>📝 Notas</span><span style={{...S.infoValB,color:"#fcd34d"}}>{word.notes}</span></div>}
          {word.audioNote && (
            <div style={{ display:"flex", alignItems:"center", gap:10, background:"#ffffff07", borderRadius:8, padding:"8px 12px" }}>
              <span style={S.infoKeyB}>🔊 Áudio</span>
              <span style={{...S.infoValB,flex:1,fontStyle:"italic"}}>{word.audioNote}</span>
              <button style={{...S.iconBtn,fontSize:18,opacity:1,background:"#7dd3fc22",borderRadius:8,padding:"4px 10px"}} onClick={()=>onSpeak({...word,term:word.audioNote})}>▶</button>
            </div>
          )}
          {word.imageUrl && <img src={word.imageUrl} alt={word.term} style={{ width:"100%", maxHeight:200, objectFit:"cover", borderRadius:10 }} onError={e=>{e.target.style.display="none";}} />}
        </div>
      )}
      {ip && <div style={{ padding:"10px 18px 14px", opacity:0.45 }}><span style={{ fontSize:12, color:"#94a3b8", fontStyle:"italic" }}>Tradução, pronúncia, definição, sinônimos, antônimos e mais aguardam preenchimento...</span></div>}
      <div style={{ height:3, background:ip?"linear-gradient(90deg,#f59e0b44,transparent)":"linear-gradient(90deg,#7dd3fc22,transparent)" }} />
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   PHRASE CARD
════════════════════════════════════════════════════════ */
function PhraseCard({ phrase, index, onEdit, onDelete, onSpeak }) {
  const ip       = !!phrase._pending;
  const bg       = CARD_COLORS[index % CARD_COLORS.length];
  const variants = phrase.variants || [];
  const [hovered, setHovered] = useState(false);

  return (
    <div
      style={{ background:bg, border:ip?"1px solid #f59e0b55":"1px solid #a855f722", borderRadius:16, marginBottom:14, overflow:"hidden", boxShadow:ip?"0 4px 20px #f59e0b18":"0 4px 24px #00000040", transition:"transform 0.15s,box-shadow 0.15s", cursor:ip?"pointer":"default" }}
      onClick={ip?()=>onEdit(phrase):undefined}
      onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow=ip?"0 8px 28px #f59e0b28":"0 8px 32px #a855f720"; setHovered(true);}}
      onMouseLeave={e=>{e.currentTarget.style.transform="";e.currentTarget.style.boxShadow=ip?"0 4px 20px #f59e0b18":"0 4px 24px #00000040"; setHovered(false);}}>

      {ip && <div style={{ background:"linear-gradient(90deg,#f59e0b22,#f59e0b06)", borderBottom:"1px solid #f59e0b2a", padding:"5px 18px", display:"flex", alignItems:"center", gap:8 }}><span>⏳</span><span style={{ fontSize:11, color:"#f59e0b", fontWeight:700, letterSpacing:0.5 }}>CLIQUE PARA COMPLETAR OS DADOS</span></div>}

      <div style={{ display:"flex", alignItems:"flex-start", gap:12, padding:"14px 18px 0" }}>
        <div style={{ width:34, height:34, borderRadius:9, flexShrink:0, background:ip?"#f59e0b1a":"#a855f718", border:ip?"1px solid #f59e0b33":"1px solid #a855f730", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:800, color:ip?"#f59e0b":"#c084fc", marginTop:2 }}>{index+1}</div>
        <div style={{ flex:1, minWidth:0 }}>
          {/* Main phrase */}
          <div style={{ fontSize:17, fontWeight:700, color:"#f1f5f9", fontFamily:"Georgia,serif", lineHeight:1.4, fontStyle:"italic", marginBottom:4 }}>
            "{phrase.phrase}"
            {variants.length > 0 && !hovered && (
              <span style={{ fontSize:10, color:"#c084fc", background:"#a855f718", border:"1px solid #a855f733", borderRadius:10, padding:"2px 8px", fontStyle:"normal", fontFamily:"sans-serif", marginLeft:8 }}>
                +{variants.length} variante{variants.length>1?"s":""} · passe o mouse
              </span>
            )}
          </div>
          {(phrase._dupCount > 1) && (
            <div style={{ marginBottom:6 }}>
              <span style={{
                display:"inline-flex", alignItems:"center", gap:4,
                fontSize:10, fontWeight:700, letterSpacing:0.5,
                color:"#fb923c", background:"#fb923c15",
                border:"1px solid #fb923c44",
                borderRadius:20, padding:"2px 9px",
              }} title={`Esta frase foi adicionada ${phrase._dupCount} vezes — duplicatas removidas automaticamente`}>
                ✕{phrase._dupCount - 1} duplicata{phrase._dupCount - 1 !== 1 ? "s" : ""} removida{phrase._dupCount - 1 !== 1 ? "s" : ""}
              </span>
            </div>
          )}

          {/* Variants — slide down on hover */}
          {variants.length > 0 && (
            <div style={{
              display:"flex", flexDirection:"column", gap:5,
              marginTop: hovered ? 8 : 0,
              maxHeight: hovered ? 200 : 0,
              opacity: hovered ? 1 : 0,
              overflow:"hidden",
              transition:"max-height 0.28s ease, opacity 0.22s ease, margin-top 0.22s ease",
            }}>
              {variants.map((v, i) => (
                <span key={i} style={{
                  fontSize:15, fontWeight:600, color:"#c084fc",
                  background:"#a855f714", border:"1px solid #a855f733",
                  borderRadius:8, padding:"5px 14px",
                  fontFamily:"Georgia,serif", fontStyle:"italic",
                  boxShadow:"0 0 8px #a855f718",
                }}>"{v}"</span>
              ))}
            </div>
          )}

          {phrase.pronunciation && <div style={{ fontSize:12, color:"#94a3b8", marginBottom:6, marginTop:4 }}>{phrase.pronunciation}</div>}
          <div style={{ display:"flex", gap:5, flexWrap:"wrap", alignItems:"center", marginTop:6 }}>
            {phrase.difficulty  ? <DiffBadge level={phrase.difficulty} />   : ip && <PendingDash label="dificuldade" />}
            {phrase.register    ? <RegBadge register={phrase.register} />    : ip && <PendingDash label="registro" />}
            {phrase.structure   && <span style={{ fontSize:10, color:"#c084fc", background:"#a855f711", border:"1px solid #a855f733", borderRadius:4, padding:"2px 6px" }}>{phrase.structure}</span>}
            {phrase.tags && phrase.tags.split(",").map((t,i)=><span key={i} style={{ fontSize:10, color:"#f59e0b", background:"#f59e0b11", border:"1px solid #f59e0b33", borderRadius:4, padding:"2px 6px" }}>#{t.trim()}</span>)}
          </div>
        </div>
        <div style={{ display:"flex", gap:4, flexShrink:0 }} onClick={e=>e.stopPropagation()}>
          {!ip && <button style={S.iconBtn} onClick={()=>onSpeak(phrase)}>🔊</button>}
          <button style={S.iconBtn} onClick={()=>onEdit(phrase)}>✏️</button>
          <button style={{...S.iconBtn,opacity:0.5}} onClick={()=>onDelete(phrase.id)}>🗑</button>
        </div>
      </div>

      {!ip && (
        <div style={{ padding:"12px 18px 16px", display:"flex", flexDirection:"column", gap:10 }}>
          {phrase.translation && <div style={S.infoRow}><span style={S.infoIcon}>🌐</span><span style={S.infoKey}>Tradução</span><span style={{...S.infoVal,color:"#7dd3fc",fontWeight:600}}>{phrase.translation}</span></div>}
          {phrase.literal     && <div style={S.infoRow}><span style={S.infoIcon}>🔤</span><span style={S.infoKey}>Literal</span><span style={{...S.infoVal,color:"#94a3b8",fontStyle:"italic"}}>{phrase.literal}</span></div>}
          {phrase.context     && <div style={S.infoBlock}><span style={S.infoKeyB}>💡 Contexto de uso</span><span style={S.infoValB}>{phrase.context}</span></div>}
          {phrase.example     && <div style={S.infoBlock}><span style={S.infoKeyB}>💬 Exemplo</span><span style={{...S.infoValB,fontStyle:"italic",color:"#a5f3fc"}}>"{phrase.example}"</span></div>}
          {(phrase.synonymPhrases||phrase.antonymPhrases) && (
            <div style={{ display:"grid", gridTemplateColumns:phrase.synonymPhrases&&phrase.antonymPhrases?"1fr 1fr":"1fr", gap:10 }}>
              {phrase.synonymPhrases && <div style={S.infoBlock}><span style={S.infoKeyB}>≈ Sinônimas</span><div>{chips(phrase.synonymPhrases,"#34d399")}</div></div>}
              {phrase.antonymPhrases && <div style={S.infoBlock}><span style={S.infoKeyB}>≠ Antônimas</span><div>{chips(phrase.antonymPhrases,"#f87171")}</div></div>}
            </div>
          )}
          {phrase.notes     && <div style={S.infoBlock}><span style={S.infoKeyB}>📝 Notas</span><span style={{...S.infoValB,color:"#fcd34d"}}>{phrase.notes}</span></div>}
          {phrase.audioNote && (
            <div style={{ display:"flex", alignItems:"center", gap:10, background:"#ffffff07", borderRadius:8, padding:"8px 12px" }}>
              <span style={S.infoKeyB}>🔊 Áudio</span>
              <span style={{...S.infoValB,flex:1,fontStyle:"italic"}}>{phrase.audioNote}</span>
              <button style={{...S.iconBtn,fontSize:18,opacity:1,background:"#a855f722",borderRadius:8,padding:"4px 10px"}} onClick={()=>onSpeak({...phrase,phrase:phrase.audioNote})}>▶</button>
            </div>
          )}
          {phrase.imageUrl && <img src={phrase.imageUrl} alt="" style={{ width:"100%", maxHeight:200, objectFit:"cover", borderRadius:10 }} onError={e=>{e.target.style.display="none";}} />}
        </div>
      )}
      {ip && <div style={{ padding:"10px 18px 14px", opacity:0.45 }}><span style={{ fontSize:12, color:"#94a3b8", fontStyle:"italic" }}>Tradução, literal, contexto, exemplos, registro e mais aguardam preenchimento...</span></div>}
      <div style={{ height:3, background:ip?"linear-gradient(90deg,#f59e0b44,transparent)":"linear-gradient(90deg,#a855f722,transparent)" }} />
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   SHARED DEDUP UTILITY
   Runs once on load — merges duplicate cards per letter.
   keyFn extracts the comparison string (term or phrase).
════════════════════════════════════════════════════════ */
function deduplicateData(dataByLetter, keyFn) {
  const result = {};
  Object.entries(dataByLetter).forEach(([letter, list]) => {
    const seen   = {};   // normalised-key → index in `merged`
    const merged = [];
    list.forEach(item => {
      const k = keyFn(item).trim().toLowerCase();
      if (!k) { merged.push(item); return; }
      if (k in seen) {
        // Duplicate — accumulate count on the first occurrence
        merged[seen[k]] = {
          ...merged[seen[k]],
          _dupCount: (merged[seen[k]]._dupCount || 1) + 1,
        };
      } else {
        seen[k] = merged.length;
        merged.push({ ...item, _dupCount: item._dupCount || 1 });
      }
    });
    result[letter] = merged;
  });
  return result;
}

/* ════════════════════════════════════════════════════════
   MODULE: WORDS
════════════════════════════════════════════════════════ */
function WordsModule({ saveStatus }) {
  const [dataByLetter, setData] = useState({});
  const [loaded, setLoaded]     = useState(false);
  const [activeLetter, setActiveLetter] = useState("A");
  const [showModal, setShowModal]   = useState(false);
  const [showBulk,  setShowBulk]   = useState(false);
  const [editing,   setEditing]    = useState(null);
  const [search,    setSearch]     = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterDiff, setFilterDiff] = useState("all");
  const [sortAsc,   setSortAsc]    = useState(false);
  const [onlyPend,  setOnlyPend]   = useState(false);
  const [backupFlash,  setBackupFlash]  = useState(false);
  const [restoreFlash, setRestoreFlash] = useState(false);
  const [restoreError, setRestoreError] = useState("");
  const restoreInputRef = useRef(null);
  const saveTimer = useRef(null);

  const [dedupInfo,     setDedupInfo]     = useState(null); // { count, items, show }

  useEffect(()=>{
    sGetWithFallback(SK_WORDS, BACKUP_WORDS_URL).then(d=>{
      if (d) {
        const clean = deduplicateData(d, x => x.term || "");
        // Only include items that are still incomplete (pending or missing translation)
        const dupItems = Object.values(clean).flat()
          .filter(x => (x._dupCount||1) > 1 && (x._pending || !x.translation))
          .map(x => ({ label: x.term || "", count: x._dupCount || 1 }))
          .sort((a,b) => a.label.localeCompare(b.label));
        const removedTotal = Object.values(clean).flat()
          .reduce((s, x) => s + ((x._dupCount||1) - 1), 0);
        setData(clean);
        if (removedTotal > 0 && dupItems.length > 0) setDedupInfo({ count: removedTotal, items: dupItems, show: false });
      }
      setLoaded(true);
    });
  },[]);

  // Auto-prune dedupInfo list when a word gets completed
  useEffect(()=>{
    if (!dedupInfo || !loaded) return;
    const allWords = Object.values(dataByLetter).flat();
    const updatedItems = dedupInfo.items.filter(item => {
      const match = allWords.find(
        w => (w.term||"").trim().toLowerCase() === item.label.trim().toLowerCase()
      );
      // Keep in list only if still incomplete (pending or no translation)
      return match && (match._pending || !match.translation);
    });
    if (updatedItems.length !== dedupInfo.items.length) {
      if (updatedItems.length === 0) {
        setDedupInfo(null); // all completed — dismiss toast entirely
      } else {
        setDedupInfo(d => ({ ...d, items: updatedItems }));
      }
    }
  },[dataByLetter]);
  useEffect(()=>{
    if(!loaded) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(()=>sSet(SK_WORDS,dataByLetter),500);
    return ()=>clearTimeout(saveTimer.current);
  },[dataByLetter,loaded]);

  function getItems()   { return dataByLetter[activeLetter]||[]; }
  function filtered()   {
    let ws = getItems();
    if(onlyPend)          ws = ws.filter(w=>w._pending);
    if(search)            { const q=search.toLowerCase(); ws=ws.filter(w=>w.term.toLowerCase().includes(q)||w.translation?.toLowerCase().includes(q)||w.tags?.toLowerCase().includes(q)); }
    if(filterType!=="all")ws = ws.filter(w=>w.type===filterType);
    if(filterDiff!=="all")ws = ws.filter(w=>w.difficulty===filterDiff);
    return [...ws].sort((a,b)=>sortAsc?a.term.localeCompare(b.term):b.term.localeCompare(a.term));
  }

  function resetFilters() { setSearch(""); setFilterType("all"); setFilterDiff("all"); setOnlyPend(false); }

  // Deduplicate: if term already exists in this letter, merge instead of adding
  function addItem(w) {
    setData(p => {
      const list = p[activeLetter] || [];
      const key = w.term.trim().toLowerCase();
      const existIdx = list.findIndex(x => (x.term||"").trim().toLowerCase() === key);
      if (existIdx !== -1) {
        // Duplicate found — increment count and keep existing card
        const updated = [...list];
        updated[existIdx] = {
          ...updated[existIdx],
          _dupCount: (updated[existIdx]._dupCount || 1) + 1,
        };
        return { ...p, [activeLetter]: updated };
      }
      return { ...p, [activeLetter]: [...list, { ...w, _dupCount: 1 }] };
    });
    setShowModal(false);
  }

  function saveEdit(w) {
    const l = Object.keys(dataByLetter).find(l=>(dataByLetter[l]||[]).some(x=>x.id===w.id)) || activeLetter;
    setData(p => {
      const list = p[l] || [];
      const key  = w.term.trim().toLowerCase();
      // Check if editing term now matches another existing card
      const conflict = list.find(x => x.id !== w.id && (x.term||"").trim().toLowerCase() === key);
      if (conflict) {
        // Merge into the existing card, remove this one
        return {
          ...p,
          [l]: list
            .filter(x => x.id !== w.id)
            .map(x => x.id === conflict.id
              ? { ...x, _dupCount: (x._dupCount || 1) + (w._dupCount || 1) }
              : x
            ),
        };
      }
      return { ...p, [l]: list.map(x => x.id === w.id ? { ...w, _pending: false } : x) };
    });
    setEditing(null); setShowModal(false);
  }
  function deleteItem(id) { setData(p=>{ const u={...p}; Object.keys(u).forEach(l=>{u[l]=(u[l]||[]).filter(x=>x.id!==id);}); return u; }); }
  function handleEdit(w)  { setEditing(w); setShowModal(true); }
  function handleSpeak(w) { if(!window.speechSynthesis)return; const u=new SpeechSynthesisUtterance(w.term); u.lang="en-US"; window.speechSynthesis.speak(u); }
  function handleBulk(g)  { setData(p=>{ const u={...p}; Object.entries(g).forEach(([l,ws])=>{u[l]=[...(u[l]||[]),...ws];}); return u; }); }
  function backup()       {
    const date=new Date().toISOString().slice(0,10);
    const blob=new Blob([JSON.stringify({exportedAt:new Date().toISOString(),data:dataByLetter},null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download=`english_vibe_words_backup_${date}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    setBackupFlash(true); setTimeout(()=>setBackupFlash(false),1800);
  }

  function handleRestoreFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setRestoreError("");
    const reader = new FileReader();
    reader.onload = evt => {
      try {
        const json = JSON.parse(evt.target.result);
        // Accept both formats: { data: {...} } or raw { A:[...], B:[...] }
        const restored = json.data || json;
        // Validate: must be an object with letter keys
        const isValid = typeof restored === "object" && !Array.isArray(restored) &&
          Object.keys(restored).every(k => /^[A-Z]$/.test(k) || k === "exportedAt" || k === "totalWords");
        if (!isValid) throw new Error("Formato inválido");
        // Merge or replace — merge keeps existing + adds restored
        setData(prev => {
          const merged = { ...prev };
          const dataKeys = Object.keys(restored).filter(k => /^[A-Z]$/.test(k));
          dataKeys.forEach(letter => {
            const incoming = restored[letter] || [];
            const existing = merged[letter] || [];
            const existingIds = new Set(existing.map(w => w.id));
            // Only add items not already present
            const newItems = incoming.filter(w => !existingIds.has(w.id));
            merged[letter] = [...existing, ...newItems];
          });
          return merged;
        });
        setRestoreFlash(true);
        setTimeout(() => setRestoreFlash(false), 2500);
      } catch(err) {
        setRestoreError("Arquivo inválido — use um backup gerado por este app.");
      }
    };
    reader.readAsText(file);
    // Reset so same file can be re-selected
    e.target.value = "";
  }

  const total       = Object.values(dataByLetter).reduce((s,a)=>s+a.length,0);
  const totalPending= Object.values(dataByLetter).flat().filter(x=>x._pending).length;
  const curPending  = getItems().filter(x=>x._pending).length;
  const items       = filtered();

  if(!loaded) return <div style={{ padding:60, textAlign:"center", color:"#475569" }}>Carregando palavras...</div>;

  return (
    <div>
      {/* Dedup toast + expandable list */}
      {dedupInfo && (
        <div>
          {/* Toast bar */}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"9px 22px", background:"#fb923c12", borderBottom:"1px solid #fb923c33" }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
              <span style={{ fontSize:15 }}>🔁</span>
              <span style={{ fontSize:13, color:"#fb923c", fontWeight:600 }}>
                {dedupInfo.count} duplicata{dedupInfo.count!==1?"s":""} de palavras encontrada{dedupInfo.count!==1?"s":""} e removida{dedupInfo.count!==1?"s":""} automaticamente.
              </span>
              <button
                onClick={() => setDedupInfo(d => ({ ...d, show: !d.show }))}
                style={{ fontSize:11, fontWeight:700, color:"#fb923c", background:"#fb923c18", border:"1px solid #fb923c44", borderRadius:8, padding:"3px 10px", cursor:"pointer" }}
              >
                {dedupInfo.show ? "▲ ocultar lista" : `▼ ver ${dedupInfo.items.length} palavra${dedupInfo.items.length!==1?"s":""}`}
              </button>
            </div>
            <button onClick={()=>setDedupInfo(null)} style={{ background:"none", border:"none", color:"#fb923c88", cursor:"pointer", fontSize:16, padding:"0 4px", flexShrink:0 }}>✕</button>
          </div>

          {/* Expandable list — sorted A–Z */}
          {dedupInfo.show && (
            <div style={{ background:"#0d1020", borderBottom:"1px solid #fb923c22", padding:"12px 22px" }}>
              <div style={{ fontSize:10, color:"#64748b", letterSpacing:1, textTransform:"uppercase", marginBottom:10, fontWeight:700 }}>
                Palavras que tinham duplicatas — clique para ir ao card e completar os dados
              </div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                {dedupInfo.items.map((item, i) => {
                  const letter = item.label[0]?.toUpperCase() || "A";
                  // Find the actual word object so we can open its modal
                  const wordObj = (dataByLetter[letter] || []).find(
                    w => (w.term||"").trim().toLowerCase() === item.label.trim().toLowerCase()
                  );
                  return (
                    <button key={i}
                      onClick={() => {
                        // 1. Navigate to the correct letter
                        setActiveLetter(letter);
                        resetFilters();
                        // 2. Close the dedup panel
                        setDedupInfo(d => ({ ...d, show: false }));
                        // 3. Open the edit modal for that word
                        if (wordObj) {
                          setTimeout(() => { setEditing(wordObj); setShowModal(true); }, 120);
                        }
                      }}
                      style={{
                        display:"inline-flex", alignItems:"center", gap:5,
                        fontSize:11, fontFamily:"Georgia,serif",
                        color:"#e2e8f0", background:"#fb923c0e",
                        border:"1px solid #fb923c33", borderRadius:20,
                        padding:"3px 10px", cursor:"pointer",
                        transition:"all 0.15s",
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background="#fb923c22"; e.currentTarget.style.borderColor="#fb923c66"; e.currentTarget.style.color="#fb923c"; }}
                      onMouseLeave={e => { e.currentTarget.style.background="#fb923c0e"; e.currentTarget.style.borderColor="#fb923c33"; e.currentTarget.style.color="#e2e8f0"; }}
                      title={`Ir para a letra ${letter} e editar "${item.label}"`}
                    >
                      <span style={{ letterSpacing:0.2 }}>{item.label}</span>
                      <span style={{ fontSize:9, color:"#fb923c", fontWeight:700, background:"#fb923c22", borderRadius:10, padding:"1px 5px" }}>
                        ×{item.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
      {/* Subheader */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 22px", background:"#0a0f1c", borderBottom:"1px solid #ffffff08", flexWrap:"wrap", gap:8 }}>
        <div style={S.headerStats}>
          {[[total,"palavras",false],[Object.keys(dataByLetter).filter(k=>dataByLetter[k]?.length>0).length,"letras",false],[totalPending,"pendentes",totalPending>0]].map(([n,label,warn])=>(
            <div key={label} style={{...S.statBox,...(warn?{border:"1px solid #f59e0b44",background:"#f59e0b09"}:{})}}>
              <span style={{...S.statNum,...(warn?{color:"#f59e0b"}:{})}}>{n}</span>
              <span style={S.statLabel}>{label}</span>
            </div>
          ))}
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:6, alignItems:"flex-end" }}>
          <div style={{ display:"flex", gap:8 }}>
            {/* Backup download */}
            <button onClick={backup} style={{ display:"flex",alignItems:"center",gap:6, background:backupFlash?"#22c55e22":"#ffffff0a", color:backupFlash?"#22c55e":"#94a3b8", border:backupFlash?"1px solid #22c55e55":"1px solid #ffffff18", borderRadius:10,padding:"8px 14px",cursor:"pointer",fontSize:13,fontWeight:700,transition:"all 0.3s" }}>
              <span>{backupFlash?"✓":"⬇"}</span><span>{backupFlash?"Baixado!":"Backup"}</span>
            </button>
            {/* Restore upload */}
            <input
              ref={restoreInputRef}
              type="file"
              accept=".json,application/json"
              style={{ display:"none" }}
              onChange={handleRestoreFile}
            />
            <button
              onClick={()=>{ setRestoreError(""); restoreInputRef.current?.click(); }}
              style={{ display:"flex",alignItems:"center",gap:6, background:restoreFlash?"#7dd3fc22":"#ffffff0a", color:restoreFlash?"#7dd3fc":"#94a3b8", border:restoreFlash?"1px solid #7dd3fc55":"1px solid #ffffff18", borderRadius:10,padding:"8px 14px",cursor:"pointer",fontSize:13,fontWeight:700,transition:"all 0.3s" }}
              title="Restaurar dados de um arquivo de backup JSON"
            >
              <span>{restoreFlash?"✓":"⬆"}</span>
              <span>{restoreFlash?"Restaurado!":"Restaurar"}</span>
            </button>
          </div>
          {restoreError && (
            <div style={{ fontSize:11, color:"#f87171", background:"#f8717111", border:"1px solid #f8717133", borderRadius:6, padding:"4px 10px" }}>
              ⚠️ {restoreError}
            </div>
          )}
        </div>
      </div>

      {/* Thumbs */}
      <ThumbBar dataByLetter={dataByLetter} activeLetter={activeLetter} setActiveLetter={setActiveLetter}
        resetFilters={resetFilters}
        accentColor="#7dd3fc" thumbActiveExtra={{}} />

      {/* Content */}
      <main style={S.main}>
        {/* ── DAILY WORD WIDGET ── */}
        <DailyWordWidget />

        <div style={S.sectionHeader}>
          <div style={{ display:"flex",alignItems:"center",gap:14 }}>
            <span style={S.bigLetterBlue}>{activeLetter}</span>
            <span style={{ color:"#94a3b8",fontSize:14 }}>
              {getItems().length} {getItems().length===1?"palavra":"palavras"}
              {curPending>0 && <span style={{ color:"#f59e0b",marginLeft:8 }}>· {curPending} pendente{curPending!==1?"s":""}</span>}
            </span>
          </div>
          <div style={{ display:"flex",gap:8,flexWrap:"wrap",justifyContent:"flex-end" }}>
            {curPending>0 && <button style={{ display:"flex",alignItems:"center",gap:6, background:onlyPend?"#f59e0b":"#f59e0b14",color:onlyPend?"#0f172a":"#f59e0b",border:"1px solid #f59e0b44",borderRadius:10,padding:"8px 12px",cursor:"pointer",fontSize:13,fontWeight:700 }} onClick={()=>setOnlyPend(p=>!p)}>⏳ {onlyPend?"Ver todas":`${curPending} pendente${curPending!==1?"s":""}`}</button>}
            <button style={{ ...S.addBtnBlue, background:"linear-gradient(135deg,#059669,#0ea5e9)" }} onClick={()=>setShowBulk(true)}>⚡ Adicionar em Massa</button>
            <button style={S.addBtnBlue} onClick={()=>{setEditing(null);setShowModal(true);}}>✦ Adicionar</button>
          </div>
        </div>

        {getItems().length>0 && (
          <div style={S.filters}>
            <input style={S.searchInput} placeholder={`Buscar em ${activeLetter}...`} value={search} onChange={e=>setSearch(e.target.value)} />
            <select style={S.filterSelect} value={filterType} onChange={e=>setFilterType(e.target.value)}>
              <option value="all">Todos os tipos</option>
              {["noun","verb","adjective","adverb","pronoun","preposition","conjunction","interjection","phrase"].map(t=><option key={t} value={t}>{t[0].toUpperCase()+t.slice(1)}</option>)}
            </select>
            <select style={S.filterSelect} value={filterDiff} onChange={e=>setFilterDiff(e.target.value)}>
              <option value="all">Dificuldade</option>
              {["easy","medium","hard","expert"].map(d=><option key={d} value={d}>{d[0].toUpperCase()+d.slice(1)}</option>)}
            </select>
            <button style={{...S.filterSelect,cursor:"pointer",minWidth:90}} onClick={()=>setSortAsc(p=>!p)}>{sortAsc?"A → Z":"Z → A"}</button>
          </div>
        )}

        <div style={{ marginTop:16 }}>
          {items.length===0 ? (
            <div style={S.empty}>
              {getItems().length===0 ? (<>
                <div style={S.emptyLetter}>{activeLetter}</div>
                <div style={S.emptyTitle}>Sem palavras ainda</div>
                <div style={S.emptySub}>Importe várias de uma vez com <strong style={{color:"#34d399"}}>⚡ Importar</strong></div>
                <div style={{ display:"flex",gap:10,marginTop:20,flexWrap:"wrap",justifyContent:"center" }}>
                  <button style={{...S.addBtnBlue,background:"linear-gradient(135deg,#059669,#0ea5e9)"}} onClick={()=>setShowBulk(true)}>⚡ Importar em massa</button>
                  <button style={S.addBtnBlue} onClick={()=>{setEditing(null);setShowModal(true);}}>✦ Adicionar uma</button>
                </div>
              </>) : (<><div style={S.emptyIcon}>🔍</div><div style={S.emptyTitle}>Nenhum resultado</div><div style={S.emptySub}>Tente outros termos ou filtros</div></>)}
            </div>
          ) : (
            items.map((w,i)=><WordCard key={w.id} word={w} index={i} onEdit={handleEdit} onDelete={deleteItem} onSpeak={handleSpeak} />)
          )}
        </div>
      </main>

      {showBulk  && <BulkImportPanel mode="words"  onImport={handleBulk}  onClose={()=>setShowBulk(false)} />}
      {showModal && <WordModal   word={editing}   onClose={()=>{setShowModal(false);setEditing(null);}} onSave={editing?saveEdit:addItem} />}
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   DAILY WORD WIDGET — shown on Phrases page
   Picks one word per day from the Words module,
   never repeating until all words have been shown.
════════════════════════════════════════════════════════ */
const SK_DAILY = "english_vibe_daily_v1";

function DailyWordWidget() {
  const [entry,        setEntry]        = useState(null);
  const [wordId,       setWordId]       = useState(null);
  const [flipped,      setFlipped]      = useState(false);
  const [status,       setStatus]       = useState("loading");
  const [progress,     setProgress]     = useState({ shown: 0, total: 0 });
  const [quickTrans,   setQuickTrans]   = useState("");
  const [saving,       setSaving]       = useState(false);
  const [saved,        setSaved]        = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [transferred,  setTransferred]  = useState(false);
  const [editingTrans, setEditingTrans] = useState(false);
  const [editTransVal, setEditTransVal] = useState("");
  const [editingTerm,  setEditingTerm]  = useState(false);
  const [editTermVal,  setEditTermVal]  = useState("");

  // Save corrected term (word itself)
  async function handleSaveTerm() {
    const val = editTermVal.trim();
    if (!val || !wordId) return;
    setSaving(true);
    try {
      let wordsData = null;
      try { const r = await (async k => { const v = localStorage.getItem(k); return v ? {value:v} : null; })(SK_WORDS); if (r?.value) wordsData = JSON.parse(r.value); } catch (_) {}
      const updated = { ...wordsData };
      // May need to move to a different letter if first char changed
      let movedWord = null;
      Object.keys(updated).forEach(letter => {
        const idx = (updated[letter] || []).findIndex(w => w.id === wordId);
        if (idx !== -1) {
          movedWord = { ...updated[letter][idx], term: val };
          updated[letter] = updated[letter].filter((_, i) => i !== idx);
        }
      });
      if (movedWord) {
        const newLetter = val[0].toUpperCase();
        if (!updated[newLetter]) updated[newLetter] = [];
        updated[newLetter] = [...updated[newLetter], movedWord];
      }
      await (async (k,v) => localStorage.setItem(k, v))(SK_WORDS, JSON.stringify(updated));
      // Update daily cache
      try {
        const r = await (async k => { const v = localStorage.getItem(k); return v ? {value:v} : null; })(SK_DAILY);
        if (r?.value) {
          const d = JSON.parse(r.value);
          d.current.phrase = val;
          await (async (k,v) => localStorage.setItem(k, v))(SK_DAILY, JSON.stringify(d));
        }
      } catch (_) {}
      setEntry(e => ({ ...e, phrase: val }));
      setEditingTerm(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (_) {}
    setSaving(false);
  }

  // Move this word → Phrases module
  async function handleTransfer() {
    if (!wordId || transferring) return;
    setTransferring(true);
    try {
      // 1. Load both storages
      let wordsData = null;
      try { const r = await (async k => { const v = localStorage.getItem(k); return v ? {value:v} : null; })(SK_WORDS); if (r?.value) wordsData = JSON.parse(r.value); } catch (_) {}
      let phrasesData = null;
      try { const r = await (async k => { const v = localStorage.getItem(k); return v ? {value:v} : null; })(SK_PHRASES); if (r?.value) phrasesData = JSON.parse(r.value); } catch (_) {}

      // 2. Find and remove the word
      let foundWord = null;
      const updatedWords = { ...wordsData };
      Object.keys(updatedWords).forEach(letter => {
        const idx = (updatedWords[letter] || []).findIndex(w => w.id === wordId);
        if (idx !== -1) {
          foundWord = updatedWords[letter][idx];
          updatedWords[letter] = updatedWords[letter].filter((_, i) => i !== idx);
        }
      });

      if (!foundWord) { setTransferring(false); return; }

      // 3. Convert word → phrase structure and add to Phrases
      const letter = (foundWord.term || "")[0]?.toUpperCase() || "A";
      const asPhrase = {
        id: foundWord.id, phrase: foundWord.term,
        translation: foundWord.translation || "",
        literal: "", pronunciation: foundWord.pronunciation || "",
        context: "", register: "", structure: "",
        synonymPhrases: foundWord.synonyms || "",
        antonymPhrases: foundWord.antonyms || "",
        example: foundWord.example || "",
        notes: foundWord.notes || "", tags: foundWord.tags || "",
        imageUrl: foundWord.imageUrl || "", audioNote: foundWord.audioNote || "",
        difficulty: foundWord.difficulty || "", variants: foundWord.variants || [],
        _pending: foundWord._pending || false,
      };
      const updatedPhrases = { ...phrasesData };
      if (!updatedPhrases[letter]) updatedPhrases[letter] = [];
      updatedPhrases[letter] = [...updatedPhrases[letter], asPhrase];

      // 4. Save both
      await (async (k,v) => localStorage.setItem(k, v))(SK_WORDS, JSON.stringify(updatedWords));
      await (async (k,v) => localStorage.setItem(k, v))(SK_PHRASES, JSON.stringify(updatedPhrases));

      // 5. Clear daily cache so tomorrow it won't try this word again
      try { await (async (k,v) => localStorage.setItem(k, v))(SK_DAILY, JSON.stringify({ date: "", current: null, shownIds: [], totalCount: 0 })); } catch (_) {}

      setTransferred(true);
      setStatus("empty");
    } catch (_) {}
    setTransferring(false);
  }

  useEffect(() => {
    (async () => {
      try {
        const today = new Date().toISOString().slice(0, 10);

        let daily = null;
        try { const r = await (async k => { const v = localStorage.getItem(k); return v ? {value:v} : null; })(SK_DAILY); if (r?.value) daily = JSON.parse(r.value); } catch (_) {}

        if (daily?.date === today && daily?.current) {
          setEntry(daily.current);
          setWordId(daily.current.wordId || null);
          setProgress({ shown: daily.shownIds?.length || 0, total: daily.totalCount || 0 });
          setStatus(daily.current.translation ? "ok" : "no-translation");
          return;
        }

        let wordsData = null;
        try { const r = await (async k => { const v = localStorage.getItem(k); return v ? {value:v} : null; })(SK_WORDS); if (r?.value) wordsData = JSON.parse(r.value); } catch (_) {}

        // Now includes ALL words — with or without translation
        const allWords = Object.values(wordsData || {}).flat().filter(w => w.term);

        if (allWords.length === 0) { setStatus("empty"); return; }

        const totalCount = allWords.length;
        let shownIds = Array.isArray(daily?.shownIds) ? daily.shownIds : [];
        let pool = allWords.filter(w => !shownIds.includes(w.id));
        if (pool.length === 0) { pool = [...allWords]; shownIds = []; }

        const dateNum  = parseInt(today.replace(/-/g, ""), 10);
        const chosen   = pool[dateNum % pool.length];
        const newShown = [...shownIds, chosen.id];
        const current  = { phrase: chosen.term, translation: chosen.translation || "", date: today, wordId: chosen.id };

        try { await (async (k,v) => localStorage.setItem(k, v))(SK_DAILY, JSON.stringify({ date: today, current, shownIds: newShown, totalCount })); } catch (_) {}

        setEntry(current);
        setWordId(chosen.id);
        setProgress({ shown: newShown.length, total: totalCount });
        setStatus(chosen.translation ? "ok" : "no-translation");

      } catch (_) { setStatus("empty"); }
    })();
  }, []);

  async function handleSaveTranslation() {
    const val = (editingTrans ? editTransVal : quickTrans).trim();
    if (!val || !wordId) return;
    setSaving(true);
    try {
      let wordsData = null;
      try { const r = await (async k => { const v = localStorage.getItem(k); return v ? {value:v} : null; })(SK_WORDS); if (r?.value) wordsData = JSON.parse(r.value); } catch (_) {}
      const updated = { ...wordsData };
      Object.keys(updated).forEach(letter => {
        updated[letter] = (updated[letter] || []).map(w =>
          w.id === wordId ? { ...w, translation: val } : w
        );
      });
      await (async (k,v) => localStorage.setItem(k, v))(SK_WORDS, JSON.stringify(updated));
      try {
        const r = await (async k => { const v = localStorage.getItem(k); return v ? {value:v} : null; })(SK_DAILY);
        if (r?.value) {
          const d = JSON.parse(r.value);
          d.current.translation = val;
          await (async (k,v) => localStorage.setItem(k, v))(SK_DAILY, JSON.stringify(d));
        }
      } catch (_) {}
      setEntry(e => ({ ...e, translation: val }));
      setStatus("ok");
      setEditingTrans(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (_) {}
    setSaving(false);
  }

  const pct = progress.total > 0 ? Math.round((progress.shown / progress.total) * 100) : 0;
  const accentW = "#7dd3fc";

  return (
    <div style={{ position:"relative", background:"linear-gradient(135deg,#061524 0%,#0d1526 60%,#071a2e 100%)", border:`1px solid ${accentW}33`, borderRadius:20, padding:"20px 22px 16px", marginBottom:22, overflow:"hidden", boxShadow:`0 8px 40px ${accentW}18`, cursor: status==="ok" ? "pointer" : "default", userSelect:"none", minHeight:120 }}
      onClick={() => status === "ok" && setFlipped(f => !f)}
    >
      <div style={{ position:"absolute", top:-40, right:-40, width:160, height:160, borderRadius:"50%", background:`radial-gradient(circle,${accentW}15 0%,transparent 70%)`, pointerEvents:"none" }} />
      <div style={{ position:"absolute", bottom:-30, left:-20, width:100, height:100, borderRadius:"50%", background:"radial-gradient(circle,#a855f711 0%,transparent 70%)", pointerEvents:"none" }} />

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12, position:"relative", zIndex:1 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ fontSize:16, color:accentW }}>✦</span>
          <span style={{ fontSize:10, fontWeight:800, letterSpacing:2.5, color:accentW, textTransform:"uppercase" }}>Palavra do Dia</span>
        </div>
        {(status === "ok" || status === "no-translation") && (
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ fontSize:10, color:"#64748b", background:"#ffffff08", borderRadius:10, padding:"2px 10px" }}>{progress.shown}/{progress.total}</span>
            {status === "ok" && <span style={{ fontSize:10, color:"#475569", fontStyle:"italic" }}>{flipped ? "clique para voltar" : "clique para tradução"}</span>}
            {status === "no-translation" && <span style={{ fontSize:10, color:"#f59e0b", fontStyle:"italic" }}>sem tradução</span>}
          </div>
        )}
      </div>

      {/* Body */}
      <div style={{ position:"relative", zIndex:1, minHeight:60, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", textAlign:"center" }}
        onClick={e => (status === "no-translation" || editingTerm || editingTrans) && e.stopPropagation()}
      >
        {status === "loading" && <span style={{ fontSize:13, color:"#334155" }}>Carregando...</span>}

        {status === "empty" && (
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:6 }}>
            <span style={{ fontSize:13, color:"#475569" }}>Nenhuma palavra encontrada no módulo</span>
            <span style={{ fontSize:11, color:"#334155" }}>⬡ Palavras → adicione palavras ao vocabulário</span>
          </div>
        )}

        {(status === "ok" || status === "no-translation") && entry && (
          <>
            <div style={{ fontSize: flipped ? 16 : 30, fontWeight:900, fontFamily:"Georgia,'Playfair Display',serif", color: flipped ? "#c084fc" : "#fff", letterSpacing: flipped ? 0.5 : -0.5, lineHeight:1.2, textShadow: flipped ? "0 0 20px #c084fc55" : `0 0 28px ${accentW}22`, transition:"all 0.28s ease", fontStyle: flipped ? "italic" : "normal" }}>
              {flipped ? entry.translation : entry.phrase}
            </div>

            {/* 🔊 Speak button — always visible when term is shown */}
            {!flipped && !editingTerm && !editingTrans && (
              <button
                onClick={e => {
                  e.stopPropagation();
                  if (!window.speechSynthesis) return;
                  const u = new SpeechSynthesisUtterance(entry.phrase);
                  u.lang = "en-US";
                  window.speechSynthesis.cancel();
                  window.speechSynthesis.speak(u);
                }}
                style={{ marginTop:8, display:"flex", alignItems:"center", gap:6, background:`${accentW}18`, border:`1px solid ${accentW}44`, borderRadius:20, padding:"5px 14px", cursor:"pointer", color:accentW, fontSize:13, fontWeight:700, transition:"all 0.15s" }}
                onMouseEnter={e => { e.currentTarget.style.background=`${accentW}28`; e.currentTarget.style.boxShadow=`0 0 10px ${accentW}44`; }}
                onMouseLeave={e => { e.currentTarget.style.background=`${accentW}18`; e.currentTarget.style.boxShadow="none"; }}
                title="Ouvir pronúncia em inglês americano"
              >
                🔊 <span>ouvir pronúncia</span>
              </button>
            )}

            {/* Normal hint row — with edit buttons */}
            {status === "ok" && !editingTrans && !editingTerm && (
              <div style={{ marginTop:6, display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", justifyContent:"center" }} onClick={e => e.stopPropagation()}>
                <span style={{ fontSize:11, color:"#475569", letterSpacing:0.5 }}>
                  {flipped ? `↑ ${entry.phrase}` : "▼ clique para ver a tradução"}
                </span>
                {/* Edit TERM — visible when NOT flipped */}
                {!flipped && (
                  <button
                    style={{ fontSize:11, color:accentW, background:"#7dd3fc14", border:"1px solid #7dd3fc33", borderRadius:6, padding:"2px 8px", cursor:"pointer", fontWeight:600 }}
                    onClick={e => { e.stopPropagation(); setEditTermVal(entry.phrase || ""); setEditingTerm(true); }}
                    title="Corrigir a palavra"
                  >✏️ corrigir palavra</button>
                )}
                {/* Edit TRANSLATION — visible when flipped */}
                {flipped && (
                  <button
                    style={{ fontSize:11, color:accentW, background:"#7dd3fc14", border:"1px solid #7dd3fc33", borderRadius:6, padding:"2px 8px", cursor:"pointer", fontWeight:600 }}
                    onClick={e => { e.stopPropagation(); setEditTransVal(entry.translation || ""); setEditingTrans(true); setFlipped(false); }}
                    title="Corrigir a tradução"
                  >✏️ corrigir tradução</button>
                )}
              </div>
            )}

            {/* Edit TERM inline form */}
            {status === "ok" && editingTerm && (
              <div style={{ marginTop:10, display:"flex", flexDirection:"column", alignItems:"center", gap:8, width:"100%" }} onClick={e => e.stopPropagation()}>
                <span style={{ fontSize:11, color:accentW }}>Corrigir a palavra:</span>
                <div style={{ display:"flex", gap:6, width:"100%", maxWidth:380 }}>
                  <input
                    autoFocus
                    style={{ ...S.input, flex:1, fontSize:14, padding:"7px 12px", borderColor:`${accentW}55`, fontWeight:700, fontFamily:"Georgia,serif" }}
                    placeholder="Nova palavra..."
                    value={editTermVal}
                    onChange={e => setEditTermVal(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") handleSaveTerm(); if (e.key === "Escape") setEditingTerm(false); }}
                    onClick={e => e.stopPropagation()}
                  />
                  <button
                    style={{ padding:"7px 14px", borderRadius:8, border:"none", cursor: editTermVal.trim() ? "pointer" : "default", fontSize:13, fontWeight:700, background: saved ? "#22c55e" : editTermVal.trim() ? `linear-gradient(135deg,#1d4ed8,${accentW})` : "#ffffff0a", color:"#fff", transition:"all 0.2s", whiteSpace:"nowrap", flexShrink:0 }}
                    onClick={e => { e.stopPropagation(); handleSaveTerm(); }}
                    disabled={!editTermVal.trim() || saving}
                  >
                    {saved ? "✓" : saving ? "..." : "💾"}
                  </button>
                  <button
                    style={{ padding:"7px 10px", borderRadius:8, border:"1px solid #ffffff14", cursor:"pointer", fontSize:12, background:"#ffffff0a", color:"#64748b" }}
                    onClick={e => { e.stopPropagation(); setEditingTerm(false); }}
                  >✕</button>
                </div>
              </div>
            )}

            {/* Edit TRANSLATION inline form */}
            {status === "ok" && editingTrans && (
              <div style={{ marginTop:10, display:"flex", flexDirection:"column", alignItems:"center", gap:8, width:"100%" }} onClick={e => e.stopPropagation()}>
                <span style={{ fontSize:11, color:accentW }}>Corrigir tradução:</span>
                <div style={{ display:"flex", gap:6, width:"100%", maxWidth:380 }}>
                  <input
                    autoFocus
                    style={{ ...S.input, flex:1, fontSize:13, padding:"7px 12px", borderColor:`${accentW}55` }}
                    placeholder="Nova tradução..."
                    value={editTransVal}
                    onChange={e => setEditTransVal(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") handleSaveTranslation(); if (e.key === "Escape") setEditingTrans(false); }}
                    onClick={e => e.stopPropagation()}
                  />
                  <button
                    style={{ padding:"7px 14px", borderRadius:8, border:"none", cursor: editTransVal.trim() ? "pointer" : "default", fontSize:13, fontWeight:700, background: saved ? "#22c55e" : editTransVal.trim() ? `linear-gradient(135deg,#1d4ed8,${accentW})` : "#ffffff0a", color:"#fff", transition:"all 0.2s", whiteSpace:"nowrap", flexShrink:0 }}
                    onClick={e => { e.stopPropagation(); handleSaveTranslation(); }}
                    disabled={!editTransVal.trim() || saving}
                  >
                    {saved ? "✓" : saving ? "..." : "💾"}
                  </button>
                  <button
                    style={{ padding:"7px 10px", borderRadius:8, border:"1px solid #ffffff14", cursor:"pointer", fontSize:12, background:"#ffffff0a", color:"#64748b" }}
                    onClick={e => { e.stopPropagation(); setEditingTrans(false); }}
                  >✕</button>
                </div>
              </div>
            )}

            {/* Quick-add translation */}
            {status === "no-translation" && (
              <div style={{ marginTop:12, display:"flex", flexDirection:"column", alignItems:"center", gap:8, width:"100%" }} onClick={e => e.stopPropagation()}>
                <span style={{ fontSize:11, color:"#f59e0b" }}>Esta palavra ainda não tem tradução — adicione agora:</span>
                <div style={{ display:"flex", gap:6, width:"100%", maxWidth:380 }}>
                  <input
                    style={{ ...S.input, flex:1, fontSize:13, padding:"7px 12px", borderColor:"#f59e0b44" }}
                    placeholder="Digite a tradução..."
                    value={quickTrans}
                    onChange={e => setQuickTrans(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleSaveTranslation()}
                    onClick={e => e.stopPropagation()}
                  />
                  <button
                    style={{ padding:"7px 16px", borderRadius:8, border:"none", cursor: quickTrans.trim() ? "pointer" : "default", fontSize:13, fontWeight:700, background: saved ? "#22c55e" : quickTrans.trim() ? "linear-gradient(135deg,#f59e0b,#fb923c)" : "#ffffff0a", color: quickTrans.trim() || saved ? "#0f172a" : "#475569", transition:"all 0.2s", whiteSpace:"nowrap", flexShrink:0 }}
                    onClick={e => { e.stopPropagation(); handleSaveTranslation(); }}
                    disabled={!quickTrans.trim() || saving}
                  >
                    {saved ? "✓ Salvo!" : saving ? "..." : "💾 Salvar"}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Progress bar + Transfer button */}
      {(status === "ok" || status === "no-translation") && (
        <div style={{ marginTop:14, position:"relative", zIndex:1 }}>
          <div style={{ height:3, borderRadius:10, background:"#ffffff0a", overflow:"hidden" }}>
            <div style={{ height:"100%", borderRadius:10, width:`${pct}%`, background:`linear-gradient(90deg,#1d4ed8,${accentW})`, boxShadow:`0 0 8px ${accentW}55`, transition:"width 0.6s ease", minWidth: pct > 0 ? 8 : 0 }} />
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:6 }} onClick={e => e.stopPropagation()}>
            <span style={{ fontSize:9, color:"#334155" }}>{pct}% do vocabulário exibido · {entry?.date}</span>
            <button
              style={{ display:"flex", alignItems:"center", gap:5, fontSize:10, fontWeight:700, background: transferred ? "#22c55e18" : "#a855f718", color: transferred ? "#22c55e" : "#c084fc", border: transferred ? "1px solid #22c55e44" : "1px solid #a855f744", borderRadius:8, padding:"3px 10px", cursor: transferring ? "default" : "pointer", transition:"all 0.2s", whiteSpace:"nowrap" }}
              onClick={e => { e.stopPropagation(); handleTransfer(); }}
              disabled={transferring}
              title="Mover esta palavra para o módulo Frases"
            >
              {transferred ? "✓ Movida para Frases" : transferring ? "..." : "↗ Mover para Frases"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   DAILY PHRASE WIDGET — shown on Phrases page
   Same logic as DailyWordWidget but reads from SK_PHRASES
   and displays phrase + translation in purple identity.
════════════════════════════════════════════════════════ */
const SK_DAILY_PHRASE = "english_vibe_daily_phrase_v1";

function DailyPhraseWidget() {
  const [entry,        setEntry]        = useState(null);
  const [phraseId,     setPhraseId]     = useState(null);
  const [flipped,      setFlipped]      = useState(false);
  const [status,       setStatus]       = useState("loading");
  const [progress,     setProgress]     = useState({ shown: 0, total: 0 });
  const [quickTrans,   setQuickTrans]   = useState("");
  const [saving,       setSaving]       = useState(false);
  const [saved,        setSaved]        = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [transferred,  setTransferred]  = useState(false);
  const [editingTrans, setEditingTrans] = useState(false);
  const [editTransVal, setEditTransVal] = useState("");
  const [editingTerm,  setEditingTerm]  = useState(false);
  const [editTermVal,  setEditTermVal]  = useState("");

  // Save corrected phrase text
  async function handleSaveTerm() {
    const val = editTermVal.trim();
    if (!val || !phraseId) return;
    setSaving(true);
    try {
      let phrasesData = null;
      try { const r = await (async k => { const v = localStorage.getItem(k); return v ? {value:v} : null; })(SK_PHRASES); if (r?.value) phrasesData = JSON.parse(r.value); } catch (_) {}
      const updated = { ...phrasesData };
      let movedPhrase = null;
      Object.keys(updated).forEach(letter => {
        const idx = (updated[letter] || []).findIndex(p => p.id === phraseId);
        if (idx !== -1) {
          movedPhrase = { ...updated[letter][idx], phrase: val };
          updated[letter] = updated[letter].filter((_, i) => i !== idx);
        }
      });
      if (movedPhrase) {
        const newLetter = val[0].toUpperCase();
        if (!updated[newLetter]) updated[newLetter] = [];
        updated[newLetter] = [...updated[newLetter], movedPhrase];
      }
      await (async (k,v) => localStorage.setItem(k, v))(SK_PHRASES, JSON.stringify(updated));
      try {
        const r = await (async k => { const v = localStorage.getItem(k); return v ? {value:v} : null; })(SK_DAILY_PHRASE);
        if (r?.value) {
          const d = JSON.parse(r.value);
          d.current.phrase = val;
          await (async (k,v) => localStorage.setItem(k, v))(SK_DAILY_PHRASE, JSON.stringify(d));
        }
      } catch (_) {}
      setEntry(e => ({ ...e, phrase: val }));
      setEditingTerm(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (_) {}
    setSaving(false);
  }

  // Move this phrase → Words module
  async function handleTransfer() {
    if (!phraseId || transferring) return;
    setTransferring(true);
    try {
      let phrasesData = null;
      try { const r = await (async k => { const v = localStorage.getItem(k); return v ? {value:v} : null; })(SK_PHRASES); if (r?.value) phrasesData = JSON.parse(r.value); } catch (_) {}
      let wordsData = null;
      try { const r = await (async k => { const v = localStorage.getItem(k); return v ? {value:v} : null; })(SK_WORDS); if (r?.value) wordsData = JSON.parse(r.value); } catch (_) {}

      // Find and remove the phrase
      let foundPhrase = null;
      const updatedPhrases = { ...phrasesData };
      Object.keys(updatedPhrases).forEach(letter => {
        const idx = (updatedPhrases[letter] || []).findIndex(p => p.id === phraseId);
        if (idx !== -1) {
          foundPhrase = updatedPhrases[letter][idx];
          updatedPhrases[letter] = updatedPhrases[letter].filter((_, i) => i !== idx);
        }
      });

      if (!foundPhrase) { setTransferring(false); return; }

      // Convert phrase → word structure and add to Words
      const letter = (foundPhrase.phrase || "")[0]?.toUpperCase() || "A";
      const asWord = {
        id: foundPhrase.id, term: foundPhrase.phrase,
        translation: foundPhrase.translation || "",
        pronunciation: foundPhrase.pronunciation || "",
        synonyms: foundPhrase.synonymPhrases || "",
        antonyms: foundPhrase.antonymPhrases || "",
        definition: foundPhrase.context || "",
        example: foundPhrase.example || "",
        notes: foundPhrase.notes || "", tags: foundPhrase.tags || "",
        imageUrl: foundPhrase.imageUrl || "", audioNote: foundPhrase.audioNote || "",
        difficulty: foundPhrase.difficulty || "", type: "", variants: foundPhrase.variants || [],
        _pending: foundPhrase._pending || false,
      };
      const updatedWords = { ...wordsData };
      if (!updatedWords[letter]) updatedWords[letter] = [];
      updatedWords[letter] = [...updatedWords[letter], asWord];

      await (async (k,v) => localStorage.setItem(k, v))(SK_PHRASES, JSON.stringify(updatedPhrases));
      await (async (k,v) => localStorage.setItem(k, v))(SK_WORDS, JSON.stringify(updatedWords));

      // Clear daily phrase cache
      try { await (async (k,v) => localStorage.setItem(k, v))(SK_DAILY_PHRASE, JSON.stringify({ date: "", current: null, shownIds: [], totalCount: 0 })); } catch (_) {}

      setTransferred(true);
      setStatus("empty");
    } catch (_) {}
    setTransferring(false);
  }

  useEffect(() => {
    (async () => {
      try {
        const today = new Date().toISOString().slice(0, 10);

        let daily = null;
        try { const r = await (async k => { const v = localStorage.getItem(k); return v ? {value:v} : null; })(SK_DAILY_PHRASE); if (r?.value) daily = JSON.parse(r.value); } catch (_) {}

        if (daily?.date === today && daily?.current) {
          setEntry(daily.current);
          setPhraseId(daily.current.phraseId || null);
          setProgress({ shown: daily.shownIds?.length || 0, total: daily.totalCount || 0 });
          setStatus(daily.current.translation ? "ok" : "no-translation");
          return;
        }

        let phrasesData = null;
        try { const r = await (async k => { const v = localStorage.getItem(k); return v ? {value:v} : null; })(SK_PHRASES); if (r?.value) phrasesData = JSON.parse(r.value); } catch (_) {}

        // ALL phrases — with or without translation
        const allPhrases = Object.values(phrasesData || {}).flat().filter(p => p.phrase);

        if (allPhrases.length === 0) { setStatus("empty"); return; }

        const totalCount = allPhrases.length;
        let shownIds = Array.isArray(daily?.shownIds) ? daily.shownIds : [];
        let pool = allPhrases.filter(p => !shownIds.includes(p.id));
        if (pool.length === 0) { pool = [...allPhrases]; shownIds = []; }

        const dateNum  = parseInt(today.replace(/-/g, ""), 10);
        const chosen   = pool[dateNum % pool.length];
        const newShown = [...shownIds, chosen.id];
        const current  = { phrase: chosen.phrase, translation: chosen.translation || "", date: today, phraseId: chosen.id };

        try { await (async (k,v) => localStorage.setItem(k, v))(SK_DAILY_PHRASE, JSON.stringify({ date: today, current, shownIds: newShown, totalCount })); } catch (_) {}

        setEntry(current);
        setPhraseId(chosen.id);
        setProgress({ shown: newShown.length, total: totalCount });
        setStatus(chosen.translation ? "ok" : "no-translation");

      } catch (_) { setStatus("empty"); }
    })();
  }, []);

  async function handleSaveTranslation() {
    const val = (editingTrans ? editTransVal : quickTrans).trim();
    if (!val || !phraseId) return;
    setSaving(true);
    try {
      let phrasesData = null;
      try { const r = await (async k => { const v = localStorage.getItem(k); return v ? {value:v} : null; })(SK_PHRASES); if (r?.value) phrasesData = JSON.parse(r.value); } catch (_) {}
      const updated = { ...phrasesData };
      Object.keys(updated).forEach(letter => {
        updated[letter] = (updated[letter] || []).map(p =>
          p.id === phraseId ? { ...p, translation: val } : p
        );
      });
      await (async (k,v) => localStorage.setItem(k, v))(SK_PHRASES, JSON.stringify(updated));
      try {
        const r = await (async k => { const v = localStorage.getItem(k); return v ? {value:v} : null; })(SK_DAILY_PHRASE);
        if (r?.value) {
          const d = JSON.parse(r.value);
          d.current.translation = val;
          await (async (k,v) => localStorage.setItem(k, v))(SK_DAILY_PHRASE, JSON.stringify(d));
        }
      } catch (_) {}
      setEntry(e => ({ ...e, translation: val }));
      setStatus("ok");
      setEditingTrans(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (_) {}
    setSaving(false);
  }

  const pct = progress.total > 0 ? Math.round((progress.shown / progress.total) * 100) : 0;
  const accentP = "#c084fc";

  return (
    <div style={{ position:"relative", background:"linear-gradient(135deg,#1e0a3c 0%,#0d1526 60%,#150d2e 100%)", border:`1px solid ${accentP}33`, borderRadius:20, padding:"20px 22px 16px", marginBottom:22, overflow:"hidden", boxShadow:`0 8px 40px ${accentP}18`, cursor: status==="ok" ? "pointer" : "default", userSelect:"none", minHeight:120 }}
      onClick={() => status === "ok" && setFlipped(f => !f)}
    >
      <div style={{ position:"absolute", top:-40, right:-40, width:160, height:160, borderRadius:"50%", background:`radial-gradient(circle,${accentP}15 0%,transparent 70%)`, pointerEvents:"none" }} />
      <div style={{ position:"absolute", bottom:-30, left:-20, width:100, height:100, borderRadius:"50%", background:"radial-gradient(circle,#7dd3fc11 0%,transparent 70%)", pointerEvents:"none" }} />

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12, position:"relative", zIndex:1 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ fontSize:16, color:accentP }}>❝</span>
          <span style={{ fontSize:10, fontWeight:800, letterSpacing:2.5, color:accentP, textTransform:"uppercase" }}>Frase do Dia</span>
        </div>
        {(status === "ok" || status === "no-translation") && (
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ fontSize:10, color:"#64748b", background:"#ffffff08", borderRadius:10, padding:"2px 10px" }}>{progress.shown}/{progress.total}</span>
            {status === "ok" && <span style={{ fontSize:10, color:"#475569", fontStyle:"italic" }}>{flipped ? "clique para voltar" : "clique para tradução"}</span>}
            {status === "no-translation" && <span style={{ fontSize:10, color:"#f59e0b", fontStyle:"italic" }}>sem tradução</span>}
          </div>
        )}
      </div>

      {/* Body */}
      <div style={{ position:"relative", zIndex:1, minHeight:68, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", textAlign:"center" }}
        onClick={e => (status === "no-translation" || editingTerm || editingTrans) && e.stopPropagation()}
      >
        {status === "loading" && <span style={{ fontSize:13, color:"#334155" }}>Carregando...</span>}

        {status === "empty" && (
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:6 }}>
            <span style={{ fontSize:13, color:"#475569" }}>Nenhuma frase encontrada neste módulo</span>
            <span style={{ fontSize:11, color:"#334155" }}>❝ Frases → adicione frases ao vocabulário</span>
          </div>
        )}

        {(status === "ok" || status === "no-translation") && entry && (
          <>
            <div style={{ fontSize: flipped ? 15 : 20, fontWeight:700, fontFamily:"Georgia,'Playfair Display',serif", color: flipped ? accentP : "#f1f5f9", lineHeight:1.4, textShadow: flipped ? `0 0 20px ${accentP}55` : "0 0 24px #ffffff18", transition:"all 0.28s ease", fontStyle:"italic", maxWidth:"92%" }}>
              {flipped ? entry.translation : `"${entry.phrase}"`}
            </div>

            {/* 🔊 Speak button — visible when phrase is shown, not when flipped or editing */}
            {!flipped && !editingTerm && !editingTrans && (
              <button
                onClick={e => {
                  e.stopPropagation();
                  if (!window.speechSynthesis) return;
                  const u = new SpeechSynthesisUtterance(entry.phrase);
                  u.lang = "en-US";
                  window.speechSynthesis.cancel();
                  window.speechSynthesis.speak(u);
                }}
                style={{ marginTop:8, display:"flex", alignItems:"center", gap:6, background:`${accentP}18`, border:`1px solid ${accentP}44`, borderRadius:20, padding:"5px 14px", cursor:"pointer", color:accentP, fontSize:13, fontWeight:700, transition:"all 0.15s" }}
                onMouseEnter={e => { e.currentTarget.style.background=`${accentP}28`; e.currentTarget.style.boxShadow=`0 0 10px ${accentP}44`; }}
                onMouseLeave={e => { e.currentTarget.style.background=`${accentP}18`; e.currentTarget.style.boxShadow="none"; }}
                title="Ouvir pronúncia em inglês americano"
              >
                🔊 <span>ouvir pronúncia</span>
              </button>
            )}

            {/* Normal hint row — with edit buttons */}
            {status === "ok" && !editingTrans && !editingTerm && (
              <div style={{ marginTop:6, display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", justifyContent:"center" }} onClick={e => e.stopPropagation()}>
                <span style={{ fontSize:11, color:"#475569", letterSpacing:0.5 }}>
                  {flipped ? `↑ "${entry.phrase}"` : "▼ clique para ver a tradução"}
                </span>
                {/* Edit PHRASE — visible when NOT flipped */}
                {!flipped && (
                  <button
                    style={{ fontSize:11, color:accentP, background:"#a855f714", border:"1px solid #a855f733", borderRadius:6, padding:"2px 8px", cursor:"pointer", fontWeight:600 }}
                    onClick={e => { e.stopPropagation(); setEditTermVal(entry.phrase || ""); setEditingTerm(true); }}
                    title="Corrigir a frase"
                  >✏️ corrigir frase</button>
                )}
                {/* Edit TRANSLATION — visible when flipped */}
                {flipped && (
                  <button
                    style={{ fontSize:11, color:accentP, background:"#a855f714", border:"1px solid #a855f733", borderRadius:6, padding:"2px 8px", cursor:"pointer", fontWeight:600 }}
                    onClick={e => { e.stopPropagation(); setEditTransVal(entry.translation || ""); setEditingTrans(true); setFlipped(false); }}
                    title="Corrigir a tradução"
                  >✏️ corrigir tradução</button>
                )}
              </div>
            )}

            {/* Edit PHRASE inline form */}
            {status === "ok" && editingTerm && (
              <div style={{ marginTop:10, display:"flex", flexDirection:"column", alignItems:"center", gap:8, width:"100%" }} onClick={e => e.stopPropagation()}>
                <span style={{ fontSize:11, color:accentP }}>Corrigir a frase:</span>
                <div style={{ display:"flex", gap:6, width:"100%", maxWidth:420 }}>
                  <input
                    autoFocus
                    style={{ ...S.input, flex:1, fontSize:13, padding:"7px 12px", borderColor:`${accentP}55`, fontStyle:"italic" }}
                    placeholder="Nova frase..."
                    value={editTermVal}
                    onChange={e => setEditTermVal(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") handleSaveTerm(); if (e.key === "Escape") setEditingTerm(false); }}
                    onClick={e => e.stopPropagation()}
                  />
                  <button
                    style={{ padding:"7px 14px", borderRadius:8, border:"none", cursor: editTermVal.trim() ? "pointer" : "default", fontSize:13, fontWeight:700, background: saved ? "#22c55e" : editTermVal.trim() ? `linear-gradient(135deg,#7c3aed,${accentP})` : "#ffffff0a", color:"#fff", transition:"all 0.2s", whiteSpace:"nowrap", flexShrink:0 }}
                    onClick={e => { e.stopPropagation(); handleSaveTerm(); }}
                    disabled={!editTermVal.trim() || saving}
                  >
                    {saved ? "✓" : saving ? "..." : "💾"}
                  </button>
                  <button
                    style={{ padding:"7px 10px", borderRadius:8, border:"1px solid #ffffff14", cursor:"pointer", fontSize:12, background:"#ffffff0a", color:"#64748b" }}
                    onClick={e => { e.stopPropagation(); setEditingTerm(false); }}
                  >✕</button>
                </div>
              </div>
            )}

            {/* Edit TRANSLATION inline form */}
            {status === "ok" && editingTrans && (
              <div style={{ marginTop:10, display:"flex", flexDirection:"column", alignItems:"center", gap:8, width:"100%" }} onClick={e => e.stopPropagation()}>
                <span style={{ fontSize:11, color:accentP }}>Corrigir tradução:</span>
                <div style={{ display:"flex", gap:6, width:"100%", maxWidth:420 }}>
                  <input
                    autoFocus
                    style={{ ...S.input, flex:1, fontSize:13, padding:"7px 12px", borderColor:`${accentP}55` }}
                    placeholder="Nova tradução..."
                    value={editTransVal}
                    onChange={e => setEditTransVal(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") handleSaveTranslation(); if (e.key === "Escape") setEditingTrans(false); }}
                    onClick={e => e.stopPropagation()}
                  />
                  <button
                    style={{ padding:"7px 14px", borderRadius:8, border:"none", cursor: editTransVal.trim() ? "pointer" : "default", fontSize:13, fontWeight:700, background: saved ? "#22c55e" : editTransVal.trim() ? `linear-gradient(135deg,#7c3aed,${accentP})` : "#ffffff0a", color:"#fff", transition:"all 0.2s", whiteSpace:"nowrap", flexShrink:0 }}
                    onClick={e => { e.stopPropagation(); handleSaveTranslation(); }}
                    disabled={!editTransVal.trim() || saving}
                  >
                    {saved ? "✓" : saving ? "..." : "💾"}
                  </button>
                  <button
                    style={{ padding:"7px 10px", borderRadius:8, border:"1px solid #ffffff14", cursor:"pointer", fontSize:12, background:"#ffffff0a", color:"#64748b" }}
                    onClick={e => { e.stopPropagation(); setEditingTrans(false); }}
                  >✕</button>
                </div>
              </div>
            )}

            {/* Quick-add translation */}
            {status === "no-translation" && (
              <div style={{ marginTop:12, display:"flex", flexDirection:"column", alignItems:"center", gap:8, width:"100%" }} onClick={e => e.stopPropagation()}>
                <span style={{ fontSize:11, color:"#f59e0b" }}>Esta frase ainda não tem tradução — adicione agora:</span>
                <div style={{ display:"flex", gap:6, width:"100%", maxWidth:420 }}>
                  <input
                    style={{ ...S.input, flex:1, fontSize:13, padding:"7px 12px", borderColor:"#f59e0b44" }}
                    placeholder="Digite a tradução..."
                    value={quickTrans}
                    onChange={e => setQuickTrans(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleSaveTranslation()}
                    onClick={e => e.stopPropagation()}
                  />
                  <button
                    style={{ padding:"7px 16px", borderRadius:8, border:"none", cursor: quickTrans.trim() ? "pointer" : "default", fontSize:13, fontWeight:700, background: saved ? "#22c55e" : quickTrans.trim() ? `linear-gradient(135deg,#7c3aed,${accentP})` : "#ffffff0a", color: quickTrans.trim() || saved ? "#fff" : "#475569", transition:"all 0.2s", whiteSpace:"nowrap", flexShrink:0 }}
                    onClick={e => { e.stopPropagation(); handleSaveTranslation(); }}
                    disabled={!quickTrans.trim() || saving}
                  >
                    {saved ? "✓ Salvo!" : saving ? "..." : "💾 Salvar"}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Progress bar + Transfer button */}
      {(status === "ok" || status === "no-translation") && (
        <div style={{ marginTop:14, position:"relative", zIndex:1 }}>
          <div style={{ height:3, borderRadius:10, background:"#ffffff0a", overflow:"hidden" }}>
            <div style={{ height:"100%", borderRadius:10, width:`${pct}%`, background:`linear-gradient(90deg,#7c3aed,#a855f7,${accentP})`, boxShadow:`0 0 8px ${accentP}55`, transition:"width 0.6s ease", minWidth: pct > 0 ? 8 : 0 }} />
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:6 }} onClick={e => e.stopPropagation()}>
            <span style={{ fontSize:9, color:"#334155" }}>{pct}% das frases exibidas · {entry?.date}</span>
            <button
              style={{ display:"flex", alignItems:"center", gap:5, fontSize:10, fontWeight:700, background: transferred ? "#22c55e18" : "#7dd3fc18", color: transferred ? "#22c55e" : "#7dd3fc", border: transferred ? "1px solid #22c55e44" : "1px solid #7dd3fc44", borderRadius:8, padding:"3px 10px", cursor: transferring ? "default" : "pointer", transition:"all 0.2s", whiteSpace:"nowrap" }}
              onClick={e => { e.stopPropagation(); handleTransfer(); }}
              disabled={transferring}
              title="Mover esta frase para o módulo Palavras"
            >
              {transferred ? "✓ Movida para Palavras" : transferring ? "..." : "↗ Mover para Palavras"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   MODULE: PHRASES
════════════════════════════════════════════════════════ */
function PhrasesModule() {
  const [dataByLetter, setData] = useState({});
  const [loaded, setLoaded]     = useState(false);
  const [activeLetter, setActiveLetter] = useState("A");
  const [showModal, setShowModal]   = useState(false);
  const [showBulk,  setShowBulk]   = useState(false);
  const [editing,   setEditing]    = useState(null);
  const [search,    setSearch]     = useState("");
  const [filterReg,  setFilterReg]  = useState("all");
  const [filterDiff, setFilterDiff] = useState("all");
  const [sortAsc,   setSortAsc]    = useState(false);
  const [onlyPend,  setOnlyPend]   = useState(false);
  const [backupFlash,  setBackupFlash]  = useState(false);
  const [restoreFlash, setRestoreFlash] = useState(false);
  const [restoreError, setRestoreError] = useState("");
  const restoreInputRef = useRef(null);
  const saveTimer = useRef(null);

  const [dedupInfo, setDedupInfo] = useState(null); // { count, items, show }

  useEffect(()=>{
    sGetWithFallback(SK_PHRASES, BACKUP_PHRASES_URL).then(d=>{
      if (d) {
        const clean = deduplicateData(d, x => x.phrase || "");
        // Only include items still incomplete (pending or missing translation)
        const dupItems = Object.values(clean).flat()
          .filter(x => (x._dupCount||1) > 1 && (x._pending || !x.translation))
          .map(x => ({ label: x.phrase || "", count: x._dupCount || 1 }))
          .sort((a,b) => a.label.localeCompare(b.label));
        const removedTotal = Object.values(clean).flat()
          .reduce((s, x) => s + ((x._dupCount||1) - 1), 0);
        setData(clean);
        if (removedTotal > 0 && dupItems.length > 0) setDedupInfo({ count: removedTotal, items: dupItems, show: false });
      }
      setLoaded(true);
    });
  },[]);

  // Auto-prune dedupInfo list when a phrase gets completed
  useEffect(()=>{
    if (!dedupInfo || !loaded) return;
    const allPhrases = Object.values(dataByLetter).flat();
    const updatedItems = dedupInfo.items.filter(item => {
      const match = allPhrases.find(
        p => (p.phrase||"").trim().toLowerCase() === item.label.trim().toLowerCase()
      );
      return match && (match._pending || !match.translation);
    });
    if (updatedItems.length !== dedupInfo.items.length) {
      if (updatedItems.length === 0) {
        setDedupInfo(null);
      } else {
        setDedupInfo(d => ({ ...d, items: updatedItems }));
      }
    }
  },[dataByLetter]);
  useEffect(()=>{
    if(!loaded) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(()=>sSet(SK_PHRASES,dataByLetter),500);
    return ()=>clearTimeout(saveTimer.current);
  },[dataByLetter,loaded]);

  function getItems()   { return dataByLetter[activeLetter]||[]; }
  function filtered()   {
    let ps = getItems();
    if(onlyPend)          ps = ps.filter(p=>p._pending);
    if(search)            { const q=search.toLowerCase(); ps=ps.filter(p=>p.phrase.toLowerCase().includes(q)||p.translation?.toLowerCase().includes(q)||p.tags?.toLowerCase().includes(q)); }
    if(filterReg !=="all")ps = ps.filter(p=>p.register===filterReg);
    if(filterDiff!=="all")ps = ps.filter(p=>p.difficulty===filterDiff);
    return [...ps].sort((a,b)=>sortAsc?a.phrase.localeCompare(b.phrase):b.phrase.localeCompare(a.phrase));
  }

  function resetFilters() { setSearch(""); setFilterReg("all"); setFilterDiff("all"); setOnlyPend(false); }
  function addItem(p) {
    setData(prev => {
      const list = prev[activeLetter] || [];
      const key  = (p.phrase||"").trim().toLowerCase();
      const existIdx = list.findIndex(x => (x.phrase||"").trim().toLowerCase() === key);
      if (existIdx !== -1) {
        const updated = [...list];
        updated[existIdx] = {
          ...updated[existIdx],
          _dupCount: (updated[existIdx]._dupCount || 1) + 1,
        };
        return { ...prev, [activeLetter]: updated };
      }
      return { ...prev, [activeLetter]: [...list, { ...p, _dupCount: 1 }] };
    });
    setShowModal(false);
  }

  function saveEdit(p) {
    const l = Object.keys(dataByLetter).find(l=>(dataByLetter[l]||[]).some(x=>x.id===p.id)) || activeLetter;
    setData(prev => {
      const list = prev[l] || [];
      const key  = (p.phrase||"").trim().toLowerCase();
      const conflict = list.find(x => x.id !== p.id && (x.phrase||"").trim().toLowerCase() === key);
      if (conflict) {
        return {
          ...prev,
          [l]: list
            .filter(x => x.id !== p.id)
            .map(x => x.id === conflict.id
              ? { ...x, _dupCount: (x._dupCount || 1) + (p._dupCount || 1) }
              : x
            ),
        };
      }
      return { ...prev, [l]: list.map(x => x.id === p.id ? { ...p, _pending: false } : x) };
    });
    setEditing(null); setShowModal(false);
  }
  function deleteItem(id) { setData(prev=>{ const u={...prev}; Object.keys(u).forEach(l=>{u[l]=(u[l]||[]).filter(x=>x.id!==id);}); return u; }); }
  function handleEdit(p)  { setEditing(p); setShowModal(true); }
  function handleSpeak(p) { if(!window.speechSynthesis)return; const u=new SpeechSynthesisUtterance(p.phrase||p.term||""); u.lang="en-US"; window.speechSynthesis.speak(u); }
  function handleBulk(g)  { setData(prev=>{ const u={...prev}; Object.entries(g).forEach(([l,ps])=>{u[l]=[...(u[l]||[]),...ps];}); return u; }); }
  function backup()       {
    const date=new Date().toISOString().slice(0,10);
    const blob=new Blob([JSON.stringify({exportedAt:new Date().toISOString(),data:dataByLetter},null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download=`english_vibe_backup_${date}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    setBackupFlash(true); setTimeout(()=>setBackupFlash(false),1800);
  }

  function handleRestoreFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setRestoreError("");
    const reader = new FileReader();
    reader.onload = evt => {
      try {
        const json = JSON.parse(evt.target.result);
        const restored = json.data || json;
        const isValid = typeof restored === "object" && !Array.isArray(restored) &&
          Object.keys(restored).every(k => /^[A-Z]$/.test(k) || k === "exportedAt" || k === "totalPhrases");
        if (!isValid) throw new Error("Formato inválido");
        setData(prev => {
          const merged = { ...prev };
          const dataKeys = Object.keys(restored).filter(k => /^[A-Z]$/.test(k));
          dataKeys.forEach(letter => {
            const incoming = restored[letter] || [];
            const existing = merged[letter] || [];
            const existingIds = new Set(existing.map(p => p.id));
            const newItems = incoming.filter(p => !existingIds.has(p.id));
            merged[letter] = [...existing, ...newItems];
          });
          return merged;
        });
        setRestoreFlash(true);
        setTimeout(() => setRestoreFlash(false), 2500);
      } catch(err) {
        setRestoreError("Arquivo inválido — use um backup gerado por este app.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  const total       = Object.values(dataByLetter).reduce((s,a)=>s+a.length,0);
  const totalPending= Object.values(dataByLetter).flat().filter(x=>x._pending).length;
  const curPending  = getItems().filter(x=>x._pending).length;
  const items       = filtered();

  if(!loaded) return <div style={{ padding:60, textAlign:"center", color:"#475569" }}>Carregando frases...</div>;

  return (
    <div>
      {/* Dedup toast + expandable list */}
      {dedupInfo && (
        <div>
          {/* Toast bar */}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"9px 22px", background:"#fb923c12", borderBottom:"1px solid #fb923c33" }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
              <span style={{ fontSize:15 }}>🔁</span>
              <span style={{ fontSize:13, color:"#fb923c", fontWeight:600 }}>
                {dedupInfo.count} duplicata{dedupInfo.count!==1?"s":""} de frases encontrada{dedupInfo.count!==1?"s":""} e removida{dedupInfo.count!==1?"s":""} automaticamente.
              </span>
              <button
                onClick={() => setDedupInfo(d => ({ ...d, show: !d.show }))}
                style={{ fontSize:11, fontWeight:700, color:"#fb923c", background:"#fb923c18", border:"1px solid #fb923c44", borderRadius:8, padding:"3px 10px", cursor:"pointer" }}
              >
                {dedupInfo.show ? "▲ ocultar lista" : `▼ ver ${dedupInfo.items.length} frase${dedupInfo.items.length!==1?"s":""}`}
              </button>
            </div>
            <button onClick={()=>setDedupInfo(null)} style={{ background:"none", border:"none", color:"#fb923c88", cursor:"pointer", fontSize:16, padding:"0 4px", flexShrink:0 }}>✕</button>
          </div>

          {/* Expandable list — sorted A–Z */}
          {dedupInfo.show && (
            <div style={{ background:"#0d1020", borderBottom:"1px solid #fb923c22", padding:"12px 22px" }}>
              <div style={{ fontSize:10, color:"#64748b", letterSpacing:1, textTransform:"uppercase", marginBottom:10, fontWeight:700 }}>
                Frases que tinham duplicatas — clique para ir ao card e completar os dados
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
                {dedupInfo.items.map((item, i) => {
                  const letter = item.label[0]?.toUpperCase() || "A";
                  const phraseObj = (dataByLetter[letter] || []).find(
                    p => (p.phrase||"").trim().toLowerCase() === item.label.trim().toLowerCase()
                  );
                  return (
                    <button key={i}
                      onClick={() => {
                        setActiveLetter(letter);
                        resetFilters();
                        setDedupInfo(d => ({ ...d, show: false }));
                        if (phraseObj) {
                          setTimeout(() => { setEditing(phraseObj); setShowModal(true); }, 120);
                        }
                      }}
                      style={{
                        display:"inline-flex", alignItems:"center", gap:6,
                        fontSize:11, fontFamily:"Georgia,serif", fontStyle:"italic",
                        color:"#e2e8f0", background:"#fb923c0e",
                        border:"1px solid #fb923c33", borderRadius:8,
                        padding:"4px 12px", maxWidth:"100%",
                        cursor:"pointer", textAlign:"left",
                        transition:"all 0.15s",
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background="#fb923c1a"; e.currentTarget.style.borderColor="#fb923c66"; e.currentTarget.style.color="#fb923c"; }}
                      onMouseLeave={e => { e.currentTarget.style.background="#fb923c0e"; e.currentTarget.style.borderColor="#fb923c33"; e.currentTarget.style.color="#e2e8f0"; }}
                      title={`Ir para a letra ${letter} e editar esta frase`}
                    >
                      <span style={{ flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                        "{item.label}"
                      </span>
                      <span style={{ fontSize:9, color:"#fb923c", fontWeight:700, background:"#fb923c22", borderRadius:10, padding:"1px 5px", flexShrink:0 }}>
                        ×{item.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
      {/* Subheader */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 22px", background:"#0a0f1c", borderBottom:"1px solid #ffffff08", flexWrap:"wrap", gap:8 }}>
        <div style={S.headerStats}>
          {[[total,"frases",false],[Object.keys(dataByLetter).filter(k=>dataByLetter[k]?.length>0).length,"letras",false],[totalPending,"pendentes",totalPending>0]].map(([n,label,warn])=>(
            <div key={label} style={{...S.statBox,...(warn?{border:"1px solid #f59e0b44",background:"#f59e0b09"}:{})}}>
              <span style={{...S.statNum,color:warn?"#f59e0b":"#c084fc"}}>{n}</span>
              <span style={S.statLabel}>{label}</span>
            </div>
          ))}
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:6, alignItems:"flex-end" }}>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={backup} style={{ display:"flex",alignItems:"center",gap:6, background:backupFlash?"#22c55e22":"#ffffff0a", color:backupFlash?"#22c55e":"#94a3b8", border:backupFlash?"1px solid #22c55e55":"1px solid #ffffff18", borderRadius:10,padding:"8px 14px",cursor:"pointer",fontSize:13,fontWeight:700,transition:"all 0.3s" }}>
              <span>{backupFlash?"✓":"⬇"}</span><span>{backupFlash?"Baixado!":"Backup"}</span>
            </button>
            <input
              ref={restoreInputRef}
              type="file"
              accept=".json,application/json"
              style={{ display:"none" }}
              onChange={handleRestoreFile}
            />
            <button
              onClick={()=>{ setRestoreError(""); restoreInputRef.current?.click(); }}
              style={{ display:"flex",alignItems:"center",gap:6, background:restoreFlash?"#c084fc22":"#ffffff0a", color:restoreFlash?"#c084fc":"#94a3b8", border:restoreFlash?"1px solid #c084fc55":"1px solid #ffffff18", borderRadius:10,padding:"8px 14px",cursor:"pointer",fontSize:13,fontWeight:700,transition:"all 0.3s" }}
              title="Restaurar dados de um arquivo de backup JSON"
            >
              <span>{restoreFlash?"✓":"⬆"}</span>
              <span>{restoreFlash?"Restaurado!":"Restaurar"}</span>
            </button>
          </div>
          {restoreError && (
            <div style={{ fontSize:11, color:"#f87171", background:"#f8717111", border:"1px solid #f8717133", borderRadius:6, padding:"4px 10px" }}>
              ⚠️ {restoreError}
            </div>
          )}
        </div>
      </div>

      {/* Thumbs */}
      <ThumbBar dataByLetter={dataByLetter} activeLetter={activeLetter} setActiveLetter={setActiveLetter}
        resetFilters={resetFilters}
        accentColor="#a855f7" thumbActiveExtra={{ background:"#a855f7", border:"1px solid #a855f7", boxShadow:"0 0 14px #a855f766" }} />

      {/* Content */}
      <main style={S.main}>
        {/* ── DAILY PHRASE WIDGET ── */}
        <DailyPhraseWidget />

        <div style={S.sectionHeader}>
          <div style={{ display:"flex",alignItems:"center",gap:14 }}>
            <span style={S.bigLetterPurple}>{activeLetter}</span>
            <span style={{ color:"#94a3b8",fontSize:14 }}>
              {getItems().length} {getItems().length===1?"frase":"frases"}
              {curPending>0 && <span style={{ color:"#f59e0b",marginLeft:8 }}>· {curPending} pendente{curPending!==1?"s":""}</span>}
            </span>
          </div>
          <div style={{ display:"flex",gap:8,flexWrap:"wrap",justifyContent:"flex-end" }}>
            {curPending>0 && <button style={{ display:"flex",alignItems:"center",gap:6, background:onlyPend?"#f59e0b":"#f59e0b14",color:onlyPend?"#0f172a":"#f59e0b",border:"1px solid #f59e0b44",borderRadius:10,padding:"8px 12px",cursor:"pointer",fontSize:13,fontWeight:700 }} onClick={()=>setOnlyPend(p=>!p)}>⏳ {onlyPend?"Ver todas":`${curPending} pendente${curPending!==1?"s":""}`}</button>}
            <button style={{ ...S.addBtnPurple, background:"linear-gradient(135deg,#059669,#0ea5e9)" }} onClick={()=>setShowBulk(true)}>⚡ Adicionar em Massa</button>
            <button style={S.addBtnPurple} onClick={()=>{setEditing(null);setShowModal(true);}}>✦ Adicionar frase</button>
          </div>
        </div>

        {getItems().length>0 && (
          <div style={S.filters}>
            <input style={S.searchInput} placeholder={`Buscar em ${activeLetter}...`} value={search} onChange={e=>setSearch(e.target.value)} />
            <select style={S.filterSelect} value={filterReg} onChange={e=>setFilterReg(e.target.value)}>
              <option value="all">Todos os registros</option>
              {["formal","informal","neutral","slang","literary","colloquial","business","academic"].map(r=><option key={r} value={r}>{r[0].toUpperCase()+r.slice(1)}</option>)}
            </select>
            <select style={S.filterSelect} value={filterDiff} onChange={e=>setFilterDiff(e.target.value)}>
              <option value="all">Dificuldade</option>
              {["easy","medium","hard","expert"].map(d=><option key={d} value={d}>{d[0].toUpperCase()+d.slice(1)}</option>)}
            </select>
            <button style={{...S.filterSelect,cursor:"pointer",minWidth:90}} onClick={()=>setSortAsc(p=>!p)}>{sortAsc?"A → Z":"Z → A"}</button>
          </div>
        )}

        <div style={{ marginTop:16 }}>
          {items.length===0 ? (
            <div style={S.empty}>
              {getItems().length===0 ? (<>
                <div style={S.emptyLetter}>{activeLetter}</div>
                <div style={S.emptyTitle}>Nenhuma frase ainda</div>
                <div style={S.emptySub}>Importe várias de uma vez com <strong style={{color:"#c084fc"}}>⚡ Importar</strong></div>
                <div style={{ display:"flex",gap:10,marginTop:20,flexWrap:"wrap",justifyContent:"center" }}>
                  <button style={S.addBtnPurple} onClick={()=>setShowBulk(true)}>⚡ Importar frases</button>
                  <button style={S.addBtnPurple} onClick={()=>{setEditing(null);setShowModal(true);}}>✦ Adicionar uma</button>
                </div>
              </>) : (<><div style={S.emptyIcon}>🔍</div><div style={S.emptyTitle}>Nenhum resultado</div><div style={S.emptySub}>Tente outros termos ou filtros</div></>)}
            </div>
          ) : (
            items.map((p,i)=><PhraseCard key={p.id} phrase={p} index={i} onEdit={handleEdit} onDelete={deleteItem} onSpeak={handleSpeak} />)
          )}
        </div>
      </main>

      {showBulk  && <BulkImportPanel mode="phrases" onImport={handleBulk}  onClose={()=>setShowBulk(false)} />}
      {showModal && <PhraseModal phrase={editing} onClose={()=>{setShowModal(false);setEditing(null);}} onSave={editing?saveEdit:addItem} />}
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   ROOT APP — with tab bar
════════════════════════════════════════════════════════ */
function App() {
  const [tab, setTab]           = useState("words");
  const [saveStatus, setSaveStatus] = useState("saved");

  return (
    <div style={S.app}>
      <div style={S.bgDecor} />

      {/* ── MAIN HEADER ── */}
      <header style={S.header}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <span style={{
            fontSize:28,
            filter: tab==="words"
              ? "drop-shadow(0 0 10px #7dd3fc88)"
              : "drop-shadow(0 0 10px #c084fc88)",
          }}>
            {tab==="words" ? "⬡" : "❝"}
          </span>
          <div>
            <div style={{
              ...S.logoTitle,
              color: tab==="words" ? "#7dd3fc" : "#c084fc",
              textShadow: tab==="words"
                ? "0 0 20px #7dd3fc55"
                : "0 0 20px #c084fc55",
              transition: "color 0.3s, text-shadow 0.3s",
            }}>
              English VIBE
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:3 }}>
              <div style={S.logoSub}>{tab==="words" ? "Palavras" : "Frases & Expressões"}</div>
              <div style={{ display:"flex", alignItems:"center", gap:4, fontSize:10, color:saveStatus==="saving"?"#f59e0b":"#22c55e", transition:"color 0.4s" }}>
                <span style={{ width:5, height:5, borderRadius:"50%", display:"inline-block", background:saveStatus==="saving"?"#f59e0b":"#22c55e", boxShadow:saveStatus==="saving"?"0 0 5px #f59e0b":"0 0 5px #22c55e" }} />
                {saveStatus==="saving" ? "salvando..." : "salvo"}
              </div>
            </div>
          </div>
        </div>

        {/* ── TAB SWITCHER ── */}
        <div style={{ display:"flex", background:"#ffffff08", borderRadius:12, padding:3, border:"1px solid #ffffff10" }}>
          {[
            { id:"words",   icon:"⬡", label:"Palavras" },
            { id:"phrases", icon:"❝", label:"Frases"   },
          ].map(({ id, icon, label }) => (
            <button key={id} onClick={()=>setTab(id)} style={{
              display:"flex", alignItems:"center", gap:7,
              padding:"9px 18px", borderRadius:10, border:"none", cursor:"pointer",
              fontSize:13, fontWeight:700, transition:"all 0.2s",
              background: tab===id ? (id==="words" ? "linear-gradient(135deg,#1d4ed8,#0ea5e9)" : "linear-gradient(135deg,#7c3aed,#a855f7)") : "transparent",
              color: tab===id ? "#fff" : "#64748b",
              boxShadow: tab===id ? (id==="words" ? "0 2px 12px #1d4ed844" : "0 2px 12px #7c3aed44") : "none",
            }}>
              <span style={{ fontSize:15 }}>{icon}</span>
              <span>{label}</span>
            </button>
          ))}
        </div>
      </header>

      {/* ── MODULE CONTENT ── */}
      {tab==="words"   && <WordsModule   saveStatus={saveStatus} />}
      {tab==="phrases" && <PhrasesModule saveStatus={saveStatus} />}
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   STYLES
════════════════════════════════════════════════════════ */
const S = {
  app:         { minHeight:"100vh", background:"#080c14", color:"#e2e8f0", fontFamily:"'DM Sans','Segoe UI',system-ui,sans-serif", position:"relative", overflow:"hidden" },
  bgDecor:     { position:"fixed", top:-200, right:-200, width:600, height:600, background:"radial-gradient(circle,#1e3a5f55 0%,transparent 70%)", pointerEvents:"none", zIndex:0 },
  header:      { display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 22px", borderBottom:"1px solid #ffffff0a", background:"#0a0f1c", position:"relative", zIndex:10, flexWrap:"wrap", gap:10 },
  logoTitle:   { fontSize:19, fontWeight:900, letterSpacing:6, color:"#fff", fontFamily:"Georgia,serif", lineHeight:1 },
  logoSub:     { fontSize:10, color:"#475569", letterSpacing:3, textTransform:"uppercase" },
  headerStats: { display:"flex", gap:8 },
  statBox:     { display:"flex", flexDirection:"column", alignItems:"center", background:"#ffffff07", border:"1px solid #ffffff0f", borderRadius:9, padding:"6px 12px" },
  statNum:     { fontSize:17, fontWeight:800, color:"#7dd3fc", lineHeight:1 },
  statLabel:   { fontSize:9, color:"#64748b", letterSpacing:1, textTransform:"uppercase", marginTop:2 },
  main:        { maxWidth:820, margin:"0 auto", padding:"20px 18px 60px", position:"relative", zIndex:5 },
  sectionHeader:{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:14, flexWrap:"wrap", gap:10 },
  bigLetterBlue:  { fontSize:60, fontWeight:900, lineHeight:0.85, color:"#7dd3fc18", fontFamily:"Georgia,serif", letterSpacing:-4, textShadow:"0 0 40px #7dd3fc22" },
  bigLetterPurple:{ fontSize:60, fontWeight:900, lineHeight:0.85, color:"#a855f710", fontFamily:"Georgia,serif", letterSpacing:-4, textShadow:"0 0 40px #a855f722" },
  addBtnBlue:  { display:"flex",alignItems:"center",gap:7, background:"linear-gradient(135deg,#1d4ed8,#7c3aed)", color:"#fff",border:"none",borderRadius:11,padding:"10px 16px",cursor:"pointer",fontSize:14,fontWeight:700,boxShadow:"0 4px 18px #1d4ed844" },
  addBtnPurple:{ display:"flex",alignItems:"center",gap:7, background:"linear-gradient(135deg,#7c3aed,#a855f7)", color:"#fff",border:"none",borderRadius:11,padding:"10px 16px",cursor:"pointer",fontSize:14,fontWeight:700,boxShadow:"0 4px 18px #7c3aed44" },
  filters:     { display:"flex", gap:7, flexWrap:"wrap", marginBottom:4 },
  searchInput: { flex:1, minWidth:150, background:"#ffffff08", border:"1px solid #ffffff14", borderRadius:8, padding:"8px 13px", color:"#e2e8f0", fontSize:14, outline:"none" },
  filterSelect:{ background:"#ffffff08", border:"1px solid #ffffff14", borderRadius:8, padding:"8px 11px", color:"#94a3b8", fontSize:13, outline:"none" },
  empty:       { textAlign:"center", padding:"55px 20px", display:"flex", flexDirection:"column", alignItems:"center", gap:8 },
  emptyLetter: { fontSize:68, fontWeight:900, color:"#ffffff08", fontFamily:"Georgia,serif", lineHeight:1 },
  emptyIcon:   { fontSize:48 },
  emptyTitle:  { fontSize:19, fontWeight:700, color:"#334155", marginTop:8 },
  emptySub:    { fontSize:14, color:"#475569", lineHeight:1.7 },
  iconBtn:     { background:"transparent", border:"none", cursor:"pointer", fontSize:15, padding:"4px 6px", borderRadius:6, lineHeight:1, opacity:0.7 },
  infoRow:     { display:"flex", alignItems:"center", gap:8, padding:"6px 10px", background:"#ffffff07", borderRadius:8 },
  infoIcon:    { fontSize:14, flexShrink:0 },
  infoKey:     { fontSize:11, fontWeight:700, letterSpacing:1, color:"#475569", textTransform:"uppercase", flexShrink:0, minWidth:68 },
  infoVal:     { fontSize:14, color:"#cbd5e1", lineHeight:1.5 },
  infoBlock:   { display:"flex", flexDirection:"column", gap:4 },
  infoKeyB:    { fontSize:11, fontWeight:700, letterSpacing:1.2, color:"#475569", textTransform:"uppercase" },
  infoValB:    { fontSize:14, color:"#cbd5e1", lineHeight:1.6 },
  overlay:     { position:"fixed", inset:0, zIndex:1000, background:"#00000099", backdropFilter:"blur(4px)", display:"flex", alignItems:"center", justifyContent:"center", padding:16 },
  modal:       { background:"#0d1526", border:"1px solid #ffffff18", borderRadius:20, width:"100%", maxWidth:620, maxHeight:"90vh", display:"flex", flexDirection:"column", boxShadow:"0 24px 80px #000000aa", overflow:"hidden" },
  modalHeader: { display:"flex", alignItems:"center", justifyContent:"space-between", padding:"15px 20px", borderBottom:"1px solid #ffffff0f", background:"#0a1020" },
  modalTitle:  { fontSize:16, fontWeight:800, color:"#e2e8f0", fontFamily:"Georgia,serif" },
  closeBtn:    { background:"#ffffff0f", border:"none", color:"#94a3b8", fontSize:14, width:28, height:28, borderRadius:7, cursor:"pointer" },
  modalBody:   { flex:1, overflowY:"auto", padding:"16px 20px", display:"flex", flexDirection:"column", gap:12 },
  modalFooter: { display:"flex", gap:10, justifyContent:"flex-end", padding:"13px 20px", borderTop:"1px solid #ffffff0f", background:"#0a1020" },
  fieldGroup:  { display:"flex", flexDirection:"column", gap:5 },
  row2:        { display:"grid", gridTemplateColumns:"1fr 1fr", gap:11 },
  label:       { fontSize:11, fontWeight:600, color:"#64748b", letterSpacing:0.5, textTransform:"uppercase" },
  input:       { background:"#ffffff08", border:"1px solid #ffffff14", borderRadius:8, padding:"9px 12px", color:"#e2e8f0", fontSize:14, outline:"none", fontFamily:"inherit" },
  select:      { background:"#ffffff08", border:"1px solid #ffffff14", borderRadius:8, padding:"9px 12px", color:"#e2e8f0", fontSize:14, outline:"none", fontFamily:"inherit" },
  cancelBtn:   { background:"#ffffff0a", border:"1px solid #ffffff14", color:"#94a3b8", borderRadius:9, padding:"9px 17px", cursor:"pointer", fontSize:13, fontWeight:600 },
  saveBtn:     { background:"linear-gradient(135deg,#1d4ed8,#7c3aed)", color:"#fff", border:"none", borderRadius:9, padding:"9px 20px", cursor:"pointer", fontSize:14, fontWeight:700, boxShadow:"0 4px 14px #1d4ed844" },
};

