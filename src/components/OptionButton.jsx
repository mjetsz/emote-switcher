import { cx } from "../lib/cx.js";
import { emoteImg } from "../state/model.js";
import styles from "./OptionButton.module.css";

export function OptionButton({ option, selected, onClick }) {
  return (
    <button
      type="button"
      class={cx(styles.option, selected && styles.selected)}
      title={option.name}
      onClick={onClick}
    >
      <img src={emoteImg(option.id)} alt={option.name} loading="lazy" />
      <span>{option.name}</span>
      {option.current ? <em>current</em> : option.custom ? <em>custom</em> : null}
    </button>
  );
}
