// Arcano Loot & Luck — Mordisco como boneco articulado.
// Um SVG em camadas: pernas, corpo, boca, língua, tampa (com os olhos) e os enfeites das emoções.
// Cada peça é animada por CSS (ver "Boneco articulado" no gacha.css). No <svg> ficam:
//   bn-capa | bn-embaralha | bn-revela   pose do momento
//   falando                              bate a tampa por um instante
//   em-ansioso | em-meh | em-feliz | em-uau | em-guloso   emoção passageira
//   gesto-olhar | gesto-lamber | gesto-bocejo | gesto-pezinho | gesto-saltinho | gesto-argolas   manias de quando está à toa
//   cuspindo                             solta uma carta
//   dormindo                             cochila quando ninguém mexe
// Os olhos seguem o ponteiro por duas variáveis: --ox e --oy.

const LOGO = "modules/gacha-magic-items/assets/arcanolab.svg";

const dente = (x, y, larg, alt) =>
  `<path d="M${x} ${y} l${larg / 2} ${alt} l${larg / 2} ${-alt} z" />`;

const estrela = (cx, cy, r) =>
  `M${cx} ${cy - r} l${r * 0.3} ${r * 0.7} ${r * 0.7} ${r * 0.3} ${-r * 0.7} ${r * 0.3} ${-r * 0.3} ${r * 0.7} `
  + `${-r * 0.3} ${-r * 0.7} ${-r * 0.7} ${-r * 0.3} ${r * 0.7} ${-r * 0.3}z`;

const olho = (cx, cy) => `
  <g class="bn-olho">
    <ellipse cx="${cx}" cy="${cy}" rx="27" ry="25" fill="#fff8ec" stroke="#3a1a22" stroke-width="3"/>
    <g class="bn-pupila">
      <g class="bn-iris">
        <circle cx="${cx}" cy="${cy + 2}" r="16" fill="#8a3fd0"/>
        <circle cx="${cx}" cy="${cy + 2}" r="9" fill="#2a0f3a"/>
        <circle cx="${cx - 6}" cy="${cy - 5}" r="5" fill="#fff"/>
        <circle cx="${cx + 6}" cy="${cy + 8}" r="2.4" fill="#fff" opacity="0.8"/>
      </g>
    </g>
    <path class="bn-estrela" fill="#ffd66b" stroke="#a8761c" stroke-width="1.5" d="${estrela(cx, cy, 18)}"/>
    <ellipse class="bn-palpebra" cx="${cx}" cy="${cy}" rx="28" ry="26" fill="#6b3a30"/>
    <g class="bn-risonho">
      <ellipse cx="${cx}" cy="${cy}" rx="28" ry="26" fill="#6b3a30"/>
      <path d="M${cx - 19} ${cy + 7} Q${cx} ${cy - 20} ${cx + 19} ${cy + 7}" fill="none" stroke="#2a0f3a" stroke-width="7"
            stroke-linecap="round"/>
    </g>
  </g>`;

const perna = (x, lado) => `
  <g class="bn-perna bn-perna-${lado}">
    <rect x="${x}" y="244" width="48" height="54" rx="15" fill="#5a2f2a" stroke="#3a1a22" stroke-width="3"/>
    <rect x="${x - 3}" y="266" width="54" height="12" rx="6" fill="#e0a83a" stroke="#8a5a14" stroke-width="2"/>
    <g class="bn-pe">
      <ellipse cx="${x + 24}" cy="300" rx="34" ry="14" fill="#5a2f2a" stroke="#3a1a22" stroke-width="3"/>
      <g fill="#f3c65a" stroke="#8a5a14" stroke-width="1.5">
        <path d="M${x - 4} 300 l7 14 7 -13z"/><path d="M${x + 16} 303 l8 14 8 -14z"/><path d="M${x + 38} 300 l7 14 7 -13z"/>
      </g>
    </g>
  </g>`;

const cartinha = k => `
  <g class="bn-carta bn-carta-${k}">
    <rect x="-13" y="-18" width="26" height="36" rx="4" fill="#241238" stroke="#e0a83a" stroke-width="2.5"/>
    <image href="${LOGO}" x="-10" y="-10" width="20" height="20"/>
  </g>`;

const argola = (cx, lado) => `
  <g class="bn-argola bn-argola-${lado}">
    <circle cx="${cx}" cy="212" r="13" fill="none" stroke="#e0a83a" stroke-width="6"/>
    <circle cx="${cx}" cy="212" r="13" fill="none" stroke="#8a5a14" stroke-width="1.5"/>
  </g>`;

/** SVG do Mordisco. `humor` é "capa", "embaralha" ou "revela" (vira uma classe no <svg>). */
export function bonecoSVG(humor = "capa") {
  const dentesBaixo = [58, 88, 118, 152, 186, 216].map(x => dente(x, 150, 26, -20)).join("");
  const dentesCima = [50, 80, 112, 146, 180, 212, 238].map((x, k) => dente(x, 144, 24, k % 2 ? 17 : 21)).join("");
  const fagulhas = [[150, 110, 9], [118, 96, 6], [184, 92, 7], [96, 124, 5], [206, 122, 6], [150, 78, 5]]
    .map(([x, y, r], k) => `<path class="bn-fagulha" style="--k:${k}" d="${estrela(x, y, r)}"/>`).join("");
  return `
<svg class="agacha-boneco bn-${humor}" viewBox="0 0 300 330" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true">
  <ellipse class="bn-sombra" cx="150" cy="316" rx="100" ry="10" fill="#000" opacity="0.4"/>
  <g class="bn-tudo">
    ${perna(70, "e")}${perna(182, "d")}

    <!-- dentro da boca: um plano escuro preso à tampa (tudo o que fica abaixo da borda dela), visto através
         de um recorte fixo em forma de leque com centro na dobradiça. O que aparece é só o vão entre a tampa
         e o baú, do tamanho da abertura; nada fica sobrando atrás quando ele se mexe. -->
    <clipPath id="bn-vao"><path d="M44 150 H254 A214 214 0 0 0 44 -64 Z"/></clipPath>
    <g clip-path="url(#bn-vao)">
      <g class="bn-tampa bn-garganta">
        <rect x="-200" y="138" width="700" height="400" fill="#2a0d1e"/>
      </g>
    </g>
    <ellipse class="bn-brasa" cx="150" cy="150" rx="78" ry="14" fill="#ffb347" opacity="0.55"/>
    <g class="bn-cartas">${cartinha(1)}${cartinha(2)}${cartinha(3)}</g>
    <g class="bn-cuspida">${cartinha(4)}</g>

    <!-- corpo do baú -->
    ${argola(30, "e")}${argola(270, "d")}
    <rect x="40" y="150" width="220" height="108" rx="14" fill="#5a2f2a" stroke="#3a1a22" stroke-width="3"/>
    <path d="M40 186 H260 M40 222 H260" stroke="#3a1a22" stroke-width="2" opacity="0.55"/>
    <path d="M62 172 h30 M210 204 h28 M70 238 h36" stroke="#7a4a40" stroke-width="2" stroke-linecap="round" opacity="0.7"/>
    <rect x="34" y="146" width="232" height="18" rx="7" fill="#e0a83a" stroke="#8a5a14" stroke-width="2.5"/>
    <path d="M44 151 h212" stroke="#fff0c0" stroke-width="2" stroke-linecap="round" opacity="0.6"/>
    <rect x="38" y="246" width="224" height="14" rx="6" fill="#e0a83a" stroke="#8a5a14" stroke-width="2.5"/>
    <rect x="36" y="150" width="16" height="108" rx="6" fill="#e0a83a" stroke="#8a5a14" stroke-width="2.5"/>
    <rect x="248" y="150" width="16" height="108" rx="6" fill="#e0a83a" stroke="#8a5a14" stroke-width="2.5"/>
    <g fill="none" stroke="#f3c65a" stroke-width="4" stroke-linecap="round">
      <path d="M68 196 q14 -14 26 0 q-12 14 -26 0"/><path d="M232 196 q-14 -14 -26 0 q12 14 26 0"/>
    </g>

    <!-- dentes de baixo -->
    <g fill="#fff3d6" stroke="#8a6a3a" stroke-width="1.5">${dentesBaixo}</g>

    <!-- flâmula com a estrela e a fechadura -->
    <g class="bn-flamula">
      <path d="M114 164 H186 V236 L150 262 L114 236 Z" fill="#241238" stroke="#e0a83a" stroke-width="4" stroke-linejoin="round"/>
      <image class="bn-logo" href="${LOGO}" x="121" y="174" width="58" height="58"/>
      <path d="M150 262 v6 M146 268 h8 l-2 13 h-4z" stroke="#8a5a14" stroke-width="2" fill="#e0a83a"/>
    </g>
    <circle cx="150" cy="160" r="15" fill="#f3c65a" stroke="#8a5a14" stroke-width="2.5"/>
    <path d="M150 153 a5 5 0 1 1 0.01 0 M147 159 h6 l2 9 h-10z" fill="#3a1a22"/>

    <!-- língua, por cima da flâmula -->
    <g class="bn-lingua">
      <path d="M132 142 C104 132 72 150 78 188 C83 212 114 208 120 182 C124 164 150 156 164 142 Z"
            fill="#c04fa8" stroke="#6d1f5e" stroke-width="3"/>
      <path d="M92 168 C90 186 100 196 108 186" fill="none" stroke="#e58fd2" stroke-width="4" stroke-linecap="round"/>
    </g>

    <!-- fagulhas que saltam da boca nas emoções fortes -->
    <g class="bn-fagulhas" fill="#ffe08a" stroke="#c98a1c" stroke-width="1">${fagulhas}</g>
    <g class="bn-arroto" fill="#e9dcff" opacity="0">
      <circle cx="150" cy="112" r="11"/><circle cx="166" cy="104" r="8"/><circle cx="138" cy="102" r="7"/>
    </g>

    <!-- tampa: gira na dobradiça da esquerda -->
    <g class="bn-tampa">
      <path d="M40 146 V100 Q40 58 150 54 Q260 58 260 100 V146 Z" fill="#6b3a30" stroke="#3a1a22" stroke-width="3"/>
      <path d="M40 104 Q150 76 260 104" fill="none" stroke="#3a1a22" stroke-width="2" opacity="0.5"/>
      <path d="M40 100 Q40 58 150 54 Q260 58 260 100" fill="none" stroke="#e0a83a" stroke-width="9" stroke-linecap="round"/>
      <path d="M58 82 Q100 62 150 60" fill="none" stroke="#fff0c0" stroke-width="2.5" stroke-linecap="round" opacity="0.6"/>
      <rect x="34" y="128" width="232" height="18" rx="7" fill="#e0a83a" stroke="#8a5a14" stroke-width="2.5"/>
      <path d="M150 62 l9 12 -9 12 -9 -12z" fill="#f3c65a" stroke="#8a5a14" stroke-width="2"/>
      <g fill="#fff3d6" stroke="#8a6a3a" stroke-width="1.5">${dentesCima}</g>
      ${olho(102, 98)}${olho(198, 98)}
      <g class="bn-sobrancelhas" fill="none" stroke="#e0a83a" stroke-width="7" stroke-linecap="round">
        <path class="bn-sob-e" d="M78 58 Q100 42 124 54"/><path class="bn-sob-d" d="M176 54 Q200 42 222 58"/>
      </g>
      <path class="bn-gota" d="M248 60 q9 14 0 20 q-9 -6 0 -20z" fill="#9fd8ff" stroke="#3f7fb5" stroke-width="1.5"/>
    </g>
  </g>

  <!-- cochilo -->
  <g class="bn-zzz" fill="#cdb6ff" font-family="Georgia, serif" font-weight="700">
    <text x="226" y="62" font-size="20">z</text><text x="246" y="42" font-size="26">z</text><text x="270" y="18" font-size="32">Z</text>
  </g>
</svg>`;
}

/** Manias do boneco quando está à toa, e por quanto tempo cada uma dura (ms). */
export const GESTOS = {
  "gesto-olhar": 2200, "gesto-lamber": 1500, "gesto-bocejo": 2400,
  "gesto-pezinho": 1600, "gesto-saltinho": 700, "gesto-argolas": 1500
};
