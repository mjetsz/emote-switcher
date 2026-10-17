import { Controls } from "./Controls.jsx";
import { CopyPanel } from "./CopyPanel.jsx";
import { EmoteGrid } from "./EmoteGrid.jsx";
import { ExtrasSection } from "./ExtrasSection.jsx";
import { SaveBar } from "./SaveBar.jsx";
import { Toolbar } from "./Toolbar.jsx";
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
