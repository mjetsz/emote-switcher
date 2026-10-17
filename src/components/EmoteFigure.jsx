import { cx } from "../cx.js";
import { emoteImg } from "../model.js";
import styles from "./EmoteFigure.module.css";

export function EmoteFigure({ emote, caption, muted = false }) {
  return (
    <figure class={styles.emote}>
      {emote ? (
        <img
          class={styles.image}
          src={emoteImg(emote.id)}
          alt={emote.name}
          loading="lazy"
        />
      ) : (
        <div class={styles.placeholder} />
      )}
      <figcaption
        class={cx(styles.caption, muted && styles.muted)}
        title={emote?.name}
      >
        {caption ?? emote?.name}
      </figcaption>
    </figure>
  );
}
