package nl.fieldday.app;

/** Fail closed: a fresh successful check is required before accessing the app. */
public final class UpdatePolicy {
 private UpdatePolicy() {}
 public static boolean canOpen(long installed, long remote, long knownRequired, boolean checked) {
  return checked && installed > 0 && remote > 0 && installed >= Math.max(remote, knownRequired);
 }
}
