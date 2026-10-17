import "./styles/base.css";
import { render } from "preact";
import { App } from "./App.jsx";
import { channelInput, loadChannel } from "./state/store.js";

render(<App />, document.getElementById("app"));
if (channelInput.value) loadChannel();
