<template>
  <svg
    viewBox="0 0 680 480"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    focusable="false"
  >
    <defs>
      <linearGradient
        id="barko-water"
        x1="340"
        y1="220"
        x2="340"
        y2="480"
        gradientUnits="userSpaceOnUse"
      >
        <stop stop-color="#45C4D4" />
        <stop offset="1" stop-color="#1571B9" />
      </linearGradient>
      <linearGradient
        id="barko-hull"
        x1="180"
        y1="260"
        x2="460"
        y2="340"
        gradientUnits="userSpaceOnUse"
      >
        <stop stop-color="#fff" />
        <stop offset="1" stop-color="#D4EFF5" />
      </linearGradient>
    </defs>
    <circle cx="494" cy="99" r="57" fill="#FFD990" />
    <path
      d="M0 244C54 192 99 152 145 165C191 178 194 223 260 239H0Z"
      fill="#53958D"
    />
    <path
      d="M398 245C430 208 470 165 508 170C546 175 569 231 680 226V291H398V245Z"
      fill="#88B4A1"
    />
    <path
      d="M0 277C89 248 144 300 230 273C335 240 387 290 472 267C541 248 615 268 680 258V480H0V277Z"
      fill="url(#barko-water)"
    />
    <path
      d="M0 340C90 308 151 360 229 333C315 302 393 354 475 329C563 303 611 331 680 321"
      stroke="#C3F7F5"
      stroke-opacity=".42"
      stroke-width="3"
    />
    <path
      d="M0 409C90 378 156 424 233 401C327 372 400 416 488 392C567 372 624 397 680 380"
      stroke="#C3F7F5"
      stroke-opacity=".3"
      stroke-width="3"
    />
    <path
      d="M151 279H513L485 316C475 329 457 336 429 336H237C207 336 188 326 176 310L151 279Z"
      fill="url(#barko-hull)"
    />
    <path d="M171 302H495" stroke="#1371B5" stroke-width="11" />
    <path d="M198 238H433L470 279H179L198 238Z" fill="#F8FFFF" />
    <path d="M252 198H362L407 237H239L252 198Z" fill="#D4EDF3" />
    <path d="M257 210H279V228H249L257 210Z" fill="#1C6687" />
    <path d="M287 210H310V228H287V210Z" fill="#1C6687" />
    <path d="M318 210H349L368 228H318V210Z" fill="#1C6687" />
    <path d="M205 251H231V265H205V251Z" fill="#25849F" />
    <path d="M242 251H268V265H242V251Z" fill="#25849F" />
    <path d="M279 251H305V265H279V251Z" fill="#25849F" />
    <path d="M316 251H342V265H316V251Z" fill="#25849F" />
    <path d="M353 251H379V265H353V251Z" fill="#25849F" />
    <path d="M390 251H421L432 265H390V251Z" fill="#25849F" />
    <path d="M302 197V146" stroke="#ECFCFF" stroke-width="5" />
    <path d="M305 149L345 160L305 172V149Z" fill="#148BA7" />
    <path
      d="M139 346C195 353 269 354 313 346M360 346C405 354 480 353 526 346"
      stroke="#D6F9FA"
      stroke-width="4"
      stroke-linecap="round"
    />
    <path
      d="M373 94L385 88L397 94M181 113L192 107L203 113"
      stroke="#347C91"
      stroke-width="3"
      stroke-linecap="round"
    />
  </svg>
</template>
<style scoped>
svg {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}
</style>
