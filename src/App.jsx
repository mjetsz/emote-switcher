import { Controls } from "./sections/Controls.jsx";
import { CopyPanel } from "./sections/CopyPanel.jsx";
import { EmoteGrid } from "./sections/EmoteGrid.jsx";
import { ExtrasSection } from "./sections/ExtrasSection.jsx";
import { SaveBar } from "./sections/SaveBar.jsx";
import { Toolbar } from "./sections/Toolbar.jsx";
import styles from "./App.module.css";

export function App() {
  return (
    <>
      <div class="container">
        <div class={styles.brand}>
          <img class={styles.logo} src="logo.svg" alt="" />
          <div>
            <h1>Emote Switcher</h1>
            <p>Swap your 7TV emotes for festive variants</p>
          </div>
        </div>
        <Controls />
        <CopyPanel />
        <Toolbar />
        <ExtrasSection />
        <EmoteGrid />
      </div>
      <SaveBar />
    </>
  );
}
