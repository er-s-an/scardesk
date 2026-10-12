/** Browser stub for path used only by Node desk paths. */
module.exports = {
  join: (...parts) => parts.filter((p) => p != null && p !== "").map(String).join("/"),
  resolve: (...parts) =>
    parts
      .filter((p) => p != null && p !== "")
      .map(String)
      .join("/") || ".",
  dirname: (p) => {
    const s = String(p == null ? "." : p);
    const i = s.lastIndexOf("/");
    return i <= 0 ? "." : s.slice(0, i);
  },
};
