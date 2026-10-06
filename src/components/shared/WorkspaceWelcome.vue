<template>
  <section
    class="workspace-welcome"
    :class="tone"
    :aria-label="`${title} workspace`"
  >
    <div class="welcome-copy">
      <p class="welcome-eyebrow">{{ eyebrow }}</p>
      <h2>{{ title }}</h2>
      <p>{{ description }}</p>
      <div class="welcome-links">
        <router-link
          v-for="link in links"
          :key="link.to"
          :to="link.to"
          @click="jump($event, link.to)"
          >{{ link.label }}
          <ion-icon :icon="openOutline" aria-hidden="true"
        /></router-link>
      </div>
    </div>
    <div class="welcome-art" aria-hidden="true">
      <span class="welcome-sun"></span><ion-icon :icon="boatOutline" /><span
        class="welcome-wave"
      ></span
      ><span class="welcome-wave second"></span>
    </div>
  </section>
</template>
<script setup lang="ts">
import { IonIcon } from "@ionic/vue";
import { openOutline, boatOutline } from "ionicons/icons";
function jump(event: MouseEvent, to: string) {
  if (
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  )
    return;
  const [path, hash] = to.split("#");
  if (hash && path === window.location.pathname) {
    const target = document.getElementById(hash);
    if (target) {
      event.preventDefault();
      target.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block: "start",
      });
    }
  }
}
withDefaults(
  defineProps<{
    eyebrow: string;
    title: string;
    description: string;
    links: Array<{ label: string; to: string }>;
    tone?: string;
  }>(),
  { tone: "ocean" },
);
</script>
<style scoped>
.workspace-welcome {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  overflow: hidden;
  isolation: isolate;
  border-radius: 20px;
  background: linear-gradient(110deg, #102c4d, #125578);
  color: #fff;
  padding: 30px 34px;
  margin-bottom: 24px;
  min-width: 0;
}
.workspace-welcome.teal {
  background: linear-gradient(110deg, #12364a, #137278);
}
.welcome-copy {
  position: relative;
  z-index: 2;
  max-width: 670px;
  min-width: 0;
}
.welcome-eyebrow {
  font-size: 10px !important;
  font-weight: 750;
  letter-spacing: 0.16em;
  color: #aee6ee !important;
  margin: 0 0 12px !important;
}
.welcome-copy h2 {
  font-size: clamp(22px, 2.3vw, 30px);
  margin: 0 0 10px;
  line-height: 1.2;
  color: white;
}
.welcome-copy > p {
  color: #d0e1ee;
  font-size: 13px;
  line-height: 1.7;
  margin: 0;
}
.welcome-links {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 20px;
}
.welcome-links a {
  display: inline-flex;
  align-items: center;
  gap: 14px;
  border: 1px solid #ffffff45;
  background: #ffffff12;
  color: #fff;
  padding: 10px 14px;
  border-radius: 9px;
  text-decoration: none;
  font-size: 12px;
  font-weight: 650;
}
.welcome-links a:hover {
  background: #ffffff26;
}
.welcome-links a:first-child {
  background: #fff;
  color: #153e60;
  border-color: #fff;
}
.welcome-art {
  position: relative;
  flex: none;
  width: 180px;
  height: 150px;
  color: #d5effa;
}
.welcome-art > ion-icon {
  position: absolute;
  font-size: 96px;
  left: 35px;
  top: 32px;
  z-index: 1;
  transform: rotate(-7deg);
}
.welcome-sun {
  position: absolute;
  width: 70px;
  height: 70px;
  border-radius: 50%;
  background: #e6c77c;
  right: 8px;
  top: 0;
  opacity: 0.85;
}
.welcome-wave {
  position: absolute;
  width: 260px;
  height: 90px;
  border-radius: 50%;
  border-top: 2px solid #b4e8f16b;
  left: -30px;
  bottom: -28px;
  transform: rotate(-8deg);
}
.welcome-wave.second {
  bottom: -43px;
  left: -50px;
  opacity: 0.5;
}
@media (max-width: 600px) {
  .workspace-welcome {
    padding: 24px 20px;
    border-radius: 16px;
    gap: 0;
  }
  .welcome-art {
    position: absolute;
    right: -45px;
    bottom: -15px;
    opacity: 0.15;
    width: 180px;
  }
  .welcome-copy {
    max-width: 100%;
  }
  .welcome-copy > p {
    font-size: 12px;
  }
  .welcome-links {
    gap: 8px;
  }
  .welcome-links a {
    font-size: 11px;
    padding: 10px 12px;
  }
  .welcome-copy h2 {
    font-size: 23px;
  }
}
</style>
