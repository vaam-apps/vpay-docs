<script setup lang="ts">
// The home page's hero illustration: a payer's phone showing a mobile-money
// approval prompt, three rails leading into it, and the PaymentIntent the
// payment settles. It is an inline SVG rather than an <img> so that every fill
// reads the theme's Material 3 tokens and the picture follows light and dark
// mode. The shapes are the theme's own Expressive shapes (cookie-9, flower,
// gem, clover-4, cookie-6), sampled from the formulas behind its
// `--md3-shape-*` properties.
//
// It is an illustration, not a capture of vpay's UI (CONTRIBUTING.md: no
// fabricated screenshots), and it draws no rail's trademark: the three rails
// are three plain shapes.
</script>

<template>
  <div class="vpay-hero-art">
    <svg
      viewBox="0 0 480 480"
      role="img"
      aria-labelledby="vpay-hero-title vpay-hero-desc"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title id="vpay-hero-title">An illustration of a vpay payment</title>
      <desc id="vpay-hero-desc">
        Three rails lead into a phone that asks its owner to approve a
        mobile-money payment of 5 000 XAF. Beside it, one PaymentIntent reads
        succeeded and another is still processing.
      </desc>

      <!-- SVG filters rather than CSS drop-shadow(): Chromium smears a CSS
           filter on an SVG group across the shapes painted before it. -->
      <defs>
        <filter
          id="vpay-hero-lift"
          x="-25%"
          y="-15%"
          width="150%"
          height="140%"
        >
          <feDropShadow
            dx="0"
            dy="12"
            stdDeviation="10"
            flood-color="#000"
            flood-opacity="0.2"
          />
        </filter>
        <filter
          id="vpay-hero-float"
          x="-20%"
          y="-30%"
          width="140%"
          height="180%"
        >
          <feDropShadow
            dx="0"
            dy="6"
            stdDeviation="7"
            flood-color="#000"
            flood-opacity="0.16"
          />
        </filter>
      </defs>

      <!-- Backdrop: Expressive shapes behind everything. -->
      <path
        class="back spin"
        d="M250 39.5C258.4 35.7 267.9 30 276.6 29.7C285.3 29.4 294.6 32.7 302.1 37.5C309.6 42.3 315.5 52.2 321.8 58.6C328.1 65 332.9 72.1 340 76.1C347.1 80.2 355.5 80.8 364.3 83.1C373 85.3 384.4 85.5 392.4 89.6C400.3 93.8 407.8 100.1 411.9 107.8C415.9 115.5 415.8 126.6 416.7 135.8C417.6 144.9 415.4 154.6 417.2 162.8C418.9 170.9 422.6 177.2 427.4 184.5C432.1 191.7 441 198.3 445.6 206.3C450.2 214.2 455 223.4 455 232C455 240.6 450.2 249.8 445.6 257.7C441 265.7 432.1 272.3 427.4 279.5C422.6 286.8 418.9 293.1 417.2 301.2C415.4 309.4 417.6 319.1 416.7 328.2C415.8 337.4 415.9 348.5 411.9 356.2C407.8 363.9 400.3 370.2 392.4 374.4C384.4 378.5 373 378.7 364.3 380.9C355.5 383.2 347.1 383.8 340 387.9C332.9 391.9 328.1 399 321.8 405.4C315.5 411.8 309.6 421.7 302.1 426.5C294.6 431.3 285.3 434.6 276.6 434.3C267.9 434 258.4 428.3 250 424.5C241.6 420.7 234.3 413.9 226.4 411.4C218.5 408.9 211.1 408.9 202.5 409.4C193.8 409.9 183.7 414.2 174.5 414.3C165.3 414.3 154.9 413.8 147.5 409.5C140.1 405.2 134.5 396.5 129.9 388.5C125.3 380.6 124.1 369.6 120.1 361.9C116.2 354.1 112.6 347.7 106.5 342.1C100.3 336.5 90.8 333.6 83.3 328.2C75.8 322.9 66.1 317.4 61.5 310.1C56.9 302.7 55.1 293 55.5 284.1C55.9 275.2 61.5 265.2 63.9 256.5C66.3 247.8 70 240.2 70 232C70 223.8 66.3 216.2 63.9 207.5C61.5 198.8 55.9 188.8 55.5 179.9C55.1 171 56.9 161.3 61.5 153.9C66.1 146.6 75.8 141.1 83.3 135.8C90.8 130.4 100.3 127.5 106.5 121.9C112.6 116.3 116.2 109.9 120.1 102.1C124.1 94.4 125.3 83.4 129.9 75.5C134.5 67.5 140.1 58.8 147.5 54.5C154.9 50.2 165.3 49.7 174.5 49.7C183.7 49.8 193.8 54.1 202.5 54.6C211.1 55.1 218.5 55.1 226.4 52.6C234.3 50.1 241.6 43.3 250 39.5Z"
      />
      <g transform="translate(92 104)">
        <path
          class="flower spin-rev"
          d="M0 -32C3.5 -32 6.4 -37 10.4 -38.6C14.4 -40.2 21 -43.3 24 -41.6C27 -39.8 27.7 -32.5 28.3 -28.3C28.9 -24 26 -19 27.7 -16C29.4 -13 35.3 -13 38.6 -10.4C42 -7.7 48 -3.5 48 0C48 3.5 42 7.7 38.6 10.4C35.3 13 29.4 13 27.7 16C26 19 28.9 24 28.3 28.3C27.7 32.5 27 39.8 24 41.6C21 43.3 14.4 40.2 10.4 38.6C6.4 37 3.5 32 0 32C-3.5 32 -6.4 37 -10.4 38.6C-14.4 40.2 -21 43.3 -24 41.6C-27 39.8 -27.7 32.5 -28.3 28.3C-28.9 24 -26 19 -27.7 16C-29.4 13 -35.3 13 -38.6 10.4C-42 7.7 -48 3.5 -48 0C-48 -3.5 -42 -7.7 -38.6 -10.4C-35.3 -13 -29.4 -13 -27.7 -16C-26 -19 -28.9 -24 -28.3 -28.3C-27.7 -32.5 -27 -39.8 -24 -41.6C-21 -43.3 -14.4 -40.2 -10.4 -38.6C-6.4 -37 -3.5 -32 0 -32Z"
        />
      </g>
      <g transform="translate(434 60)">
        <path
          class="gem"
          d="M0 -20C1.4 -20 3 -17.1 4.3 -16C5.6 -14.8 6.4 -13.9 7.6 -13.2C8.9 -12.5 10.1 -12.2 11.7 -11.7C13.3 -11.2 16.6 -11.2 17.3 -10C18 -8.8 16.3 -5.9 16 -4.3C15.6 -2.6 15.3 -1.4 15.3 0C15.3 1.4 15.6 2.6 16 4.3C16.3 5.9 18 8.8 17.3 10C16.6 11.2 13.3 11.2 11.7 11.7C10.1 12.2 8.9 12.5 7.6 13.2C6.4 13.9 5.6 14.8 4.3 16C3 17.1 1.4 20 0 20C-1.4 20 -3 17.1 -4.3 16C-5.6 14.8 -6.4 13.9 -7.6 13.2C-8.9 12.5 -10.1 12.2 -11.7 11.7C-13.3 11.2 -16.6 11.2 -17.3 10C-18 8.8 -16.3 5.9 -16 4.3C-15.6 2.6 -15.3 1.4 -15.3 0C-15.3 -1.4 -15.6 -2.6 -16 -4.3C-16.3 -5.9 -18 -8.8 -17.3 -10C-16.6 -11.2 -13.3 -11.2 -11.7 -11.7C-10.1 -12.2 -8.9 -12.5 -7.6 -13.2C-6.4 -13.9 -5.6 -14.8 -4.3 -16C-3 -17.1 -1.4 -20 0 -20Z"
        />
      </g>

      <!-- Three rails: a shape for each, and a track into the phone. A pulse
           runs along each track; it holds still for readers who ask for less
           motion. -->
      <g class="rails">
        <path class="track" d="M62 200C100 200 120 210 150 216" />
        <path class="track" d="M62 262C100 262 120 262 152 262" />
        <path class="track" d="M62 324C100 324 120 316 156 308" />
        <path
          class="pulse r1"
          pathLength="100"
          d="M62 200C100 200 120 210 150 216"
        />
        <path
          class="pulse r2"
          pathLength="100"
          d="M62 262C100 262 120 262 152 262"
        />
        <path
          class="pulse r3"
          pathLength="100"
          d="M62 324C100 324 120 316 156 308"
        />
        <path
          class="token r1"
          transform="translate(44 200)"
          d="M0 -17.8C1 -18.2 2.3 -18.9 3.3 -18.7C4.3 -18.5 5.3 -17.5 6.1 -16.8C6.9 -16.1 7.4 -15 8.3 -14.4C9.2 -13.9 10.4 -14 11.5 -13.7C12.5 -13.3 13.9 -13 14.6 -12.2C15.2 -11.4 15.3 -10 15.5 -8.9C15.6 -7.8 15.3 -6.7 15.7 -5.7C16 -4.7 17 -4 17.6 -3.1C18.1 -2.1 19 -1 19 0C19 1 18.1 2.1 17.6 3.1C17 4 16 4.7 15.7 5.7C15.3 6.7 15.6 7.8 15.5 8.9C15.3 10 15.2 11.4 14.6 12.2C13.9 13 12.5 13.3 11.5 13.7C10.4 14 9.2 13.9 8.3 14.4C7.4 15 6.9 16.1 6.1 16.8C5.3 17.5 4.3 18.5 3.3 18.7C2.3 18.9 1 18.2 0 17.8C-1 17.5 -1.9 16.6 -2.9 16.4C-3.9 16.2 -5 16.8 -6.1 16.8C-7.2 16.8 -8.6 17 -9.5 16.5C-10.4 15.9 -10.9 14.6 -11.5 13.7C-12 12.7 -12.1 11.5 -12.8 10.7C-13.4 9.9 -14.6 9.6 -15.5 8.9C-16.3 8.2 -17.5 7.5 -17.9 6.5C-18.2 5.5 -17.8 4.2 -17.6 3.1C-17.4 2 -16.7 1 -16.7 0C-16.7 -1 -17.4 -2 -17.6 -3.1C-17.8 -4.2 -18.2 -5.5 -17.9 -6.5C-17.5 -7.5 -16.3 -8.2 -15.5 -8.9C-14.6 -9.6 -13.4 -9.9 -12.8 -10.7C-12.1 -11.5 -12 -12.7 -11.5 -13.7C-10.9 -14.6 -10.4 -15.9 -9.5 -16.5C-8.6 -17 -7.2 -16.8 -6.1 -16.8C-5 -16.8 -3.9 -16.2 -2.9 -16.4C-1.9 -16.6 -1 -17.5 0 -17.8Z"
        />
        <path
          class="token r2"
          transform="translate(44 262)"
          d="M0 -20C2.1 -20 4.7 -16.8 6.2 -14.9C7.6 -13 7.2 -10.1 8.7 -8.7C10.1 -7.2 13 -7.6 14.9 -6.2C16.8 -4.7 20 -2.1 20 0C20 2.1 16.8 4.7 14.9 6.2C13 7.6 10.1 7.2 8.7 8.7C7.2 10.1 7.6 13 6.2 14.9C4.7 16.8 2.1 20 0 20C-2.1 20 -4.7 16.8 -6.2 14.9C-7.6 13 -7.2 10.1 -8.7 8.7C-10.1 7.2 -13 7.6 -14.9 6.2C-16.8 4.7 -20 2.1 -20 0C-20 -2.1 -16.8 -4.7 -14.9 -6.2C-13 -7.6 -10.1 -7.2 -8.7 -8.7C-7.2 -10.1 -7.6 -13 -6.2 -14.9C-4.7 -16.8 -2.1 -20 0 -20Z"
        />
        <path
          class="token r3"
          transform="translate(44 324)"
          d="M0 -15.3C1.4 -15.3 2.8 -16.1 4.3 -16.1C5.8 -16.1 7.8 -16.3 9 -15.6C10.2 -14.9 11.1 -13.1 11.8 -11.8C12.5 -10.5 12.6 -8.9 13.3 -7.7C14 -6.4 15.3 -5.6 16.1 -4.3C16.9 -3 18 -1.4 18 0C18 1.4 16.9 3 16.1 4.3C15.3 5.6 14 6.4 13.3 7.7C12.6 8.9 12.5 10.5 11.8 11.8C11.1 13.1 10.2 14.9 9 15.6C7.8 16.3 5.8 16.1 4.3 16.1C2.8 16.1 1.4 15.3 0 15.3C-1.4 15.3 -2.8 16.1 -4.3 16.1C-5.8 16.1 -7.8 16.3 -9 15.6C-10.2 14.9 -11.1 13.1 -11.8 11.8C-12.5 10.5 -12.6 8.9 -13.3 7.7C-14 6.4 -15.3 5.6 -16.1 4.3C-16.9 3 -18 1.4 -18 0C-18 -1.4 -16.9 -3 -16.1 -4.3C-15.3 -5.6 -14 -6.4 -13.3 -7.7C-12.6 -8.9 -12.5 -10.5 -11.8 -11.8C-11.1 -13.1 -10.2 -14.9 -9 -15.6C-7.8 -16.3 -5.8 -16.1 -4.3 -16.1C-2.8 -16.1 -1.4 -15.3 0 -15.3Z"
        />
      </g>

      <!-- The payer's phone, with a mobile-money approval prompt. -->
      <g
        class="phone"
        transform="rotate(-5 226 240)"
        filter="url(#vpay-hero-lift)"
      >
        <rect class="frame" x="140" y="56" width="172" height="368" rx="36" />
        <rect class="screen" x="149" y="65" width="154" height="350" rx="27" />
        <rect class="frame" x="205" y="74" width="42" height="10" rx="5" />

        <rect class="app-icon" x="165" y="100" width="24" height="24" rx="8" />
        <path class="app-glyph" d="M171.5 108 177 117.5 182.5 108" />
        <text class="t-label" x="197" y="117">Mobile money</text>

        <text class="t-title" x="165" y="154">Approve payment</text>
        <text class="t-body" x="165" y="173">to Mboa Market</text>

        <rect class="amount" x="165" y="188" width="122" height="76" rx="20" />
        <text class="t-currency" x="179" y="212">XAF</text>
        <text class="t-amount" x="178" y="249">5 000</text>

        <text class="t-label" x="165" y="294">Enter your PIN</text>
        <circle class="pin" cx="176" cy="314" r="7" />
        <circle class="pin" cx="199" cy="314" r="7" />
        <circle class="pin" cx="222" cy="314" r="7" />
        <circle class="pin pin-empty" cx="245" cy="314" r="6" />

        <rect class="button" x="165" y="340" width="122" height="44" rx="22" />
        <text class="t-button" x="226" y="367" text-anchor="middle">
          Approve
        </text>
      </g>

      <!-- One payment still in flight, and one that settled. -->
      <g class="float-a">
        <g filter="url(#vpay-hero-float)">
          <rect
            class="chip-info"
            x="298"
            y="112"
            width="140"
            height="36"
            rx="18"
          />
          <circle class="spinner-track" cx="318" cy="130" r="7" />
          <path class="spinner" d="M318 123a7 7 0 0 1 7 7" />
          <text class="t-chip-info" x="333" y="135">processing</text>
        </g>
      </g>

      <g class="float-b">
        <g filter="url(#vpay-hero-float)">
          <rect class="card" x="304" y="290" width="164" height="114" rx="26" />
          <text class="t-mono" x="322" y="318">pi_8k2dm…q41</text>
          <text class="t-card-amount" x="322" y="348">5 000 XAF</text>
          <rect
            class="chip-success"
            x="322"
            y="362"
            width="112"
            height="26"
            rx="13"
          />
          <path class="tick" d="M332 375.5 336.5 380 344 371.5" />
          <text class="t-chip-success" x="350" y="379.5">succeeded</text>
        </g>
      </g>
    </svg>
  </div>
</template>

<style scoped>
/* Sized like the theme's own hero art (Md3HeroArt), so it sits in VPHero's
   image box the same way at every breakpoint. */
.vpay-hero-art {
  position: relative;
  height: 100%;
  max-width: 100%;
  aspect-ratio: 1;
  margin: 0 auto;

  /* Three accent tones for the three rails. Light mode uses the scheme's
     roles directly; dark mode swaps in their fixed tones, because the
     Expressive dark primary is nearly white. */
  --hero-teal: var(--md-sys-color-primary);
  --hero-amber: var(--md-sys-color-tertiary-fixed-dim);
  --hero-ink: var(--md-sys-color-secondary);
  --hero-frame: var(--md-sys-color-inverse-surface);
  --hero-screen: var(--md-sys-color-surface-container-lowest);
}
:global(.dark .vpay-hero-art) {
  --hero-teal: var(--md-sys-color-primary-fixed-dim);
  --hero-ink: var(--md-sys-color-secondary-fixed-dim);
  --hero-frame: color-mix(
    in oklch,
    var(--md-sys-color-on-surface) 40%,
    var(--md-sys-color-surface)
  );
  --hero-screen: var(--md-sys-color-surface-container-low);
}

/* Below 60rem VPHero stacks the image above the heading and pulls the
   heading up into its box; this keeps the art clear of the title. */
@media (max-width: 59.99rem) {
  .vpay-hero-art {
    height: 88%;
    margin-top: 6%;
  }
}

.vpay-hero-art svg {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
}

/* ---- backdrop --------------------------------------------------------- */
/* A container colour this large would glare in dark mode, so it is mixed
   down toward the surface, as the theme does for its own hero art. */
.back {
  fill: color-mix(
    in oklch,
    var(--md-sys-color-primary-container) 55%,
    var(--md-sys-color-surface)
  );
}
.flower {
  fill: var(--md-sys-color-tertiary-container);
}
.gem {
  fill: var(--hero-teal);
}

/* ---- rails ------------------------------------------------------------ */
.track,
.pulse {
  fill: none;
  stroke-linecap: round;
}
/* A dotted route, and a coin travelling along it. */
.track {
  stroke: color-mix(
    in oklch,
    var(--md-sys-color-on-surface-variant) 45%,
    transparent
  );
  stroke-width: 6;
  stroke-dasharray: 0 13;
}
.pulse {
  stroke-width: 13;
  stroke-dasharray: 0.01 99.99;
  stroke-dashoffset: 100;
  animation: vpay-rail 3.6s cubic-bezier(0.4, 0, 0.2, 1) infinite;
}
.pulse.r2 {
  animation-delay: 1.2s;
}
.pulse.r3 {
  animation-delay: 2.4s;
}
.pulse.r1 {
  stroke: var(--hero-teal);
}
.pulse.r2 {
  stroke: var(--hero-amber);
}
.pulse.r3 {
  stroke: var(--hero-ink);
}
.token.r1 {
  fill: var(--hero-teal);
}
.token.r2 {
  fill: var(--hero-amber);
}
.token.r3 {
  fill: var(--hero-ink);
}

/* ---- phone ------------------------------------------------------------ */
.frame {
  fill: var(--hero-frame);
}
.screen {
  fill: var(--hero-screen);
}
.app-icon {
  fill: var(--md-sys-color-tertiary-container);
}
.app-glyph,
.tick {
  fill: none;
  stroke-width: 3;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.app-glyph {
  stroke: var(--md-sys-color-on-tertiary-container);
}
.amount {
  fill: var(--md-sys-color-primary-container);
}
.pin {
  fill: var(--md-sys-color-primary);
}
.pin-empty {
  fill: none;
  stroke: var(--md-sys-color-outline);
  stroke-width: 2;
}
.button {
  fill: var(--md-sys-color-primary);
}

/* ---- type ------------------------------------------------------------- */
text {
  font-family: var(--md-sys-typescale-plain-font, inherit);
}
.t-label {
  font-size: 11.5px;
  font-weight: 600;
  fill: var(--md-sys-color-on-surface-variant);
}
.t-title {
  font-size: 15px;
  font-weight: 800;
  fill: var(--md-sys-color-on-surface);
}
.t-body {
  font-size: 12px;
  fill: var(--md-sys-color-on-surface-variant);
}
.t-currency {
  font-size: 11.5px;
  font-weight: 700;
  letter-spacing: 0.08em;
  fill: var(--md-sys-color-on-primary-container);
}
.t-amount {
  font-size: 32px;
  font-weight: 800;
  fill: var(--md-sys-color-on-primary-container);
}
.t-button {
  font-size: 15px;
  font-weight: 700;
  fill: var(--md-sys-color-on-primary);
}
.t-mono {
  font-family: var(--md-sys-typescale-mono-font, monospace);
  font-size: 11.5px;
  fill: var(--md-sys-color-on-surface-variant);
}
.t-card-amount {
  font-size: 21px;
  font-weight: 800;
  fill: var(--md-sys-color-on-surface);
}

/* ---- chips and the PaymentIntent card -------------------------------- */
.chip-info {
  fill: var(--md-custom-color-info-container);
}
.spinner-track,
.spinner {
  fill: none;
  stroke-width: 3;
}
.spinner-track {
  stroke: color-mix(
    in srgb,
    var(--md-custom-color-on-info-container) 25%,
    transparent
  );
}
.spinner {
  stroke: var(--md-custom-color-on-info-container);
  stroke-linecap: round;
  transform-origin: 318px 130px;
  animation: vpay-spin 1.1s linear infinite;
}
.t-chip-info {
  font-size: 14px;
  font-weight: 700;
  fill: var(--md-custom-color-on-info-container);
}
.card {
  fill: var(--md-sys-color-surface-container-high);
}
.chip-success {
  fill: var(--md-custom-color-success-container);
}
.tick {
  stroke: var(--md-custom-color-on-success-container);
}
.t-chip-success {
  font-size: 13px;
  font-weight: 700;
  fill: var(--md-custom-color-on-success-container);
}

/* ---- motion: slow, and none at all for readers who ask --------------- */
.spin {
  transform-origin: 250px 232px;
  animation: vpay-spin 90s linear infinite;
}
.spin-rev {
  animation: vpay-spin 50s linear infinite reverse;
}
.float-a {
  animation: vpay-float 6s ease-in-out infinite;
}
.float-b {
  animation: vpay-float 7s ease-in-out -2.5s infinite;
}

@keyframes vpay-spin {
  to {
    transform: rotate(360deg);
  }
}
@keyframes vpay-float {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-6px);
  }
}
@keyframes vpay-rail {
  0% {
    stroke-dashoffset: 100;
    opacity: 0;
  }
  15%,
  80% {
    opacity: 1;
  }
  100% {
    stroke-dashoffset: 0;
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .spin,
  .spin-rev,
  .float-a,
  .float-b,
  .spinner,
  .pulse {
    animation: none;
  }
  .pulse {
    stroke-dashoffset: 45;
  }
}
</style>
