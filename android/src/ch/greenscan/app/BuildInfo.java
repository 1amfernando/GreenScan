package ch.greenscan.app;

/**
 * Die Version der App — EINE Zahl, und sie kommt aus {@code GS_VERSION} in
 * {@code index.html}. {@code android/build.sh} schreibt diese Datei bei jedem
 * Bau neu; von Hand geaendert wird sie nie.
 */
final class BuildInfo {
  static final String VERSION = "0.0";
  private BuildInfo() {}
}
