<template>
  <div class="maritime-header-art" :class="[{ 'is-night': night, 'has-weather': weather, 'weather-day': weather && daylight, 'weather-night': weather && !daylight }, weather && `weather-${weather}`]" :data-weather="weather || 'neutral'" aria-hidden="true">
    <img :src="ferryHeaderSrc" alt="" width="1440" height="480" decoding="async" />
    <div v-if="weather" class="harbor-sky">
      <div class="weather-stage">
        <span class="sky-stars"></span>
        <span class="sky-orb"></span>
        <svg v-for="layer in [1, 2]" :key="layer" class="sky-cloud" :class="`cloud-${layer}`" viewBox="0 0 220 86" fill="none">
          <defs>
            <linearGradient :id="`${cloudId}-${layer}`" x1="110" y1="8" x2="110" y2="78" gradientUnits="userSpaceOnUse"><stop stop-color="var(--cloud-top)" /><stop offset="1" stop-color="var(--cloud-bottom)" /></linearGradient>
            <filter :id="`${cloudId}-soft-${layer}`" x="-10%" y="-20%" width="120%" height="140%"><feTurbulence type="fractalNoise" baseFrequency=".025 .05" numOctaves="2" :seed="layer * 7" result="texture" /><feDisplacementMap in="SourceGraphic" in2="texture" scale="9" xChannelSelector="R" yChannelSelector="G" /><feGaussianBlur stdDeviation="1.3" /></filter>
          </defs>
          <path d="M40 74C23 74 12 64 14 51C16 39 27 31 41 34C45 16 60 6 77 9C94 11 104 23 106 36C116 28 129 28 140 35C153 25 173 29 181 45C198 41 211 51 210 62C209 71 199 76 184 76H40Z" :fill="`url(#${cloudId}-${layer})`" :filter="`url(#${cloudId}-soft-${layer})`" />
        </svg>
        <span class="sky-mist mist-back"></span><span class="sky-mist mist-front"></span>
      </div>
    </div>
    <div v-if="weather === 'rain' || weather === 'storm' || weather === 'snow'" class="sky-precipitation">
      <span v-for="particle in particles" :key="particle.id" class="weather-particle" :style="particle.style"></span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { HarborWeather } from '../../data/harborWeather';
import { computed, useId } from 'vue';
// Public URL avoids treating this served asset as a Node filesystem import in tests.
const ferryHeaderSrc = '/images/ferry-seascape-v2.webp';
const props = defineProps<{ night?: boolean; weather?: HarborWeather | null; daylight?: boolean }>();
const cloudId = `harbor-cloud-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
const particles = computed(() => Array.from({ length: props.weather === 'storm' ? 32 : 20 }, (_, index) => ({
  id: index,
  style: {
    left: `${(index * 37 + 7) % 100}%`,
    '--fall-speed': `${props.weather === 'snow' ? 7 + index % 5 : (props.weather === 'storm' ? .65 : 1.05) + (index % 5) * .13}s`,
    '--fall-delay': `${-index * .37}s`,
    '--particle-opacity': String(.25 + (index % 6) * .09),
    '--rest-y': `${(index * 23) % 88}%`,
  },
})));
</script>

<style scoped>
.maritime-header-art { position: absolute; inset: -20px -24px 0; overflow: hidden; pointer-events: none; user-select: none; mask-image: linear-gradient(to right, transparent 15%, #000 65%), linear-gradient(to bottom, transparent, #000 30%); mask-composite: intersect; }
.maritime-header-art img { position: absolute; right: var(--ferry-inset, 60px); bottom: -38px; width: 930px; max-width: none; height: auto; opacity: .16; mask-image: linear-gradient(to right, transparent, #000 25%, #000 94%, transparent); }
:root[data-theme="dark"] .maritime-header-art img, .maritime-header-art.is-night img { opacity: .88; }
.maritime-header-art.has-weather { isolation: isolate; --cloud-top: #c9dce8; --cloud-bottom: #6c8fa9; }
.harbor-sky { position: absolute; inset: 0; background: linear-gradient(110deg, transparent 35%, #284a651a 65%, transparent 92%); mask-image: linear-gradient(to right, transparent 25%, #000 48%, #000 78%, transparent 93%); }
.weather-stage { position: absolute; inset-block: 0; right: clamp(180px, 18vw, 360px); width: clamp(260px, 38vw, 640px); }
.weather-day .harbor-sky { background: radial-gradient(ellipse at 61% 12%, #91cfdf26, transparent 38%); }
.weather-day.weather-clear .harbor-sky { background: radial-gradient(ellipse at 58% 14%, #ffe8a22b, transparent 32%); }
.has-weather img { transition: filter 1.8s ease; }
.weather-day img { filter: brightness(1.35) saturate(.85); }
.weather-day.weather-clear img { filter: brightness(1.6) contrast(.92) saturate(.9) sepia(.12); }
.weather-day.weather-rain img, .weather-day.weather-storm img { filter: brightness(1.05) saturate(.7); }
.sky-orb { position: absolute; width: 42px; height: 42px; top: 18%; left: 31%; border-radius: 50%; opacity: 0; }
.weather-clear .sky-orb { opacity: 1; background: radial-gradient(circle at 36% 31%, #fffce0, #ffe59b 67%, #edbb5e); box-shadow: 0 0 18px 6px #ffdf8c55, 0 0 64px 24px #ffd47c1f; animation: harbor-sun 10s ease-in-out infinite alternate; }
.weather-day.weather-clear .sky-orb::before { content: ''; position: absolute; inset: -20px; border-radius: 50%; background: repeating-conic-gradient(from 0deg, transparent 0deg 27deg, #ffe5a96b 28deg 30deg); mask-image: radial-gradient(circle, transparent 47%, #000 53%, transparent 70%); animation: harbor-rays 70s linear infinite; }
.weather-night.weather-clear .sky-orb { width: 30px; height: 30px; background: radial-gradient(circle at 30% 32%, #9fb8ca66 0 3px, transparent 4px), radial-gradient(circle at 65% 58%, #a8becf66 0 4px, transparent 5px), radial-gradient(circle at 42% 76%, #a8becf55 0 2px, transparent 3px), linear-gradient(145deg, #f1f7ff, #b6cddd); box-shadow: 0 0 18px 4px #c3ddff33, 0 0 48px 12px #8ebbe51a; }
.sky-stars { position: absolute; top: 16px; left: 8%; width: 2px; height: 2px; border-radius: 50%; background: #d7ecff; box-shadow: 50px 22px #c9e5ff, 104px -3px #c9e5ff, 174px 10px #d5ebff, 223px 34px #c9e5ff, 272px 0 #c9e5ff; opacity: 0; }
.weather-night.weather-clear .sky-stars { opacity: .65; animation: harbor-stars 8s ease-in-out infinite alternate; }
.sky-cloud { position: absolute; width: 150px; height: auto; top: 2%; left: 4%; opacity: 0; filter: drop-shadow(0 4px 6px #061a2a26); animation: harbor-clouds 30s ease-in-out infinite alternate; }
.cloud-2 { width: 182px; top: -13%; left: 27%; animation-delay: -14s; animation-duration: 42s; }
.weather-cloudy .sky-cloud, .weather-rain .sky-cloud, .weather-storm .sky-cloud, .weather-snow .sky-cloud { opacity: .48; }
.weather-cloudy .cloud-1 { opacity: .26; }
.has-weather.weather-night { --cloud-top: #7894ad; --cloud-bottom: #345570; }
.has-weather.weather-rain { --cloud-top: #91a9bc; --cloud-bottom: #425f7b; }
.has-weather.weather-storm { --cloud-top: #71869f; --cloud-bottom: #263e5c; }
.weather-storm .harbor-sky { background: radial-gradient(ellipse at 64% 15%, #384e6c66, transparent 45%); }
.weather-storm .sky-cloud { opacity: .65; }
.sky-precipitation { position: absolute; inset: 0 12% 0 34%; overflow: hidden; mask-image: linear-gradient(90deg, transparent, #000 20%, #000 75%, transparent); animation: harbor-wind 12s ease-in-out infinite alternate; }
.weather-particle { position: absolute; top: -22px; width: 1px; height: 14px; border-radius: 3px; background: linear-gradient(transparent, #d0e9ffb3); opacity: var(--particle-opacity); animation: harbor-rain var(--fall-speed) var(--fall-delay) linear infinite; }
.weather-storm .weather-particle { height: 20px; background: linear-gradient(transparent, #d0e9ffcc); }
.weather-snow .weather-particle { width: 3px; height: 3px; border-radius: 50%; background: #eaf5ff; animation-name: harbor-snow; }
.sky-mist { position: absolute; inset: 22% -12% -12% 3%; opacity: 0; background: radial-gradient(ellipse at 30% 55%, #c6dce333, transparent 60%), radial-gradient(ellipse at 70% 75%, #c6dce340, transparent 55%); filter: blur(5px); }
.weather-fog .sky-mist { opacity: .65; animation: harbor-mist 24s ease-in-out infinite alternate; }.weather-fog .mist-front { inset-block-start: 48%; animation-delay: -12s; animation-direction: alternate-reverse; }
@keyframes harbor-sun { from { transform: scale(.98); } to { transform: scale(1.03); } }
@keyframes harbor-rays { to { transform: rotate(360deg); } }
@keyframes harbor-stars { from { opacity: .4; } to { opacity: .8; } }
@keyframes harbor-clouds { from { transform: translate3d(-12px, 1px, 0); } to { transform: translate3d(20px, -2px, 0); } }
@keyframes harbor-wind { from { transform: translateX(0); } to { transform: translateX(10px); } }
@keyframes harbor-rain { from { transform: translate3d(0, -20px, 0) rotate(14deg); } to { transform: translate3d(-34px, 210px, 0) rotate(14deg); } }
@keyframes harbor-snow { from { transform: translate3d(0, -10px, 0); } to { transform: translate3d(30px, 190px, 0); } }
@keyframes harbor-mist { from { transform: translate3d(-18px, 0, 0); } to { transform: translate3d(24px, 3px, 0); } }
@media (prefers-reduced-motion: reduce) {
  .sky-orb, .sky-orb::before, .sky-stars, .sky-cloud, .sky-mist, .sky-precipitation, .weather-particle { animation: none !important; }
  .weather-particle { top: var(--rest-y); transform: rotate(14deg); }
  .has-weather img { transition: none; }
}
@media (max-width: 1100px) {
  .maritime-header-art img { right: 40px; width: 760px; bottom: -26px; }
}
@media (max-width: 700px) {
  .weather-stage { right: 6px; width: 290px; opacity: .65; }.sky-orb { width: 32px; height: 32px; }.sky-cloud { width: 112px; }.cloud-2 { width: 132px; }.sky-precipitation { inset-inline: 28% 4%; opacity: .65; }
  .maritime-header-art { inset: 0 -14px; mask-image: linear-gradient(to right, transparent, #000), linear-gradient(to bottom, transparent, #000 35%); mask-composite: intersect; }
  .maritime-header-art img { right: -20px; width: 560px; bottom: -12px; opacity: .08; }
  :root[data-theme="dark"] .maritime-header-art img, .maritime-header-art.is-night img { opacity: .35; }
}
</style>
