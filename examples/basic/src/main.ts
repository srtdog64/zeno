import { UserView } from "./model.view.js";

const buffer = new ArrayBuffer(160);
const view = new DataView(buffer);

UserView.write(view, {
  id: 42n,
  age: 37,
  score: 98.5,
  ratio: 0.75,
  handle: "zeno-user",
  name: "Zeno",
  tags: ["ts", "view"],
  avatar: [1, 2, 3],
});

const user = new UserView(view);

console.log({
  id: user.id,
  age: user.age,
  score: user.score,
  ratio: user.ratio,
  handle: user.handleText().replaceAll("\u0000", ""),
  name: user.nameView().text(),
  tags: user.tagsView().toArray(),
  avatar: Array.from(user.avatarBytes()),
});
