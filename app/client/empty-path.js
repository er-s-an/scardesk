/** Browser stub for path used only by Node desk paths. */
module.exports = {
  join: (...parts) => parts.filter(Boolean).join("/"),
  resolve: (...parts) => parts.filter(Boolean).join("/"),
  dirname: (p) => {
    const i = String(p).lastIndexOf("/");
    return i <= 0 ? "." : p.slice(0, i);
  },
};
