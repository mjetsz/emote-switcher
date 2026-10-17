import "./styles/base.css";
import { render } from "preact";
import { App } from "./components/App.jsx";
import { channelInput, loadChannel } from "./store.js";

render(<App />, document.getElementById("app"));
if (channelInput.value) loadChannel();
