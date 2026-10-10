package nl.fieldday.app;

import java.io.*;
import java.security.MessageDigest;
import java.util.Set;

/** Streaming download validation, shared with JVM tests. No external storage. */
public final class ApkDownload {
 public static final long MAX_BYTES = 100L * 1024 * 1024;
 public interface Progress { void update(long bytes, long total); }
 private ApkDownload() {}
 public static File copyVerified(InputStream input, File destination, String expectedHash, long expectedLength, Progress progress) throws Exception {
  if (expectedHash == null || !expectedHash.matches("[a-f0-9]{64}") || expectedLength > MAX_BYTES) throw new IOException("Invalid APK metadata");
  File parent = destination.getParentFile();
  if (!parent.isDirectory() && !parent.mkdirs()) throw new IOException("Cannot create update directory");
  File partial = new File(parent, destination.getName() + ".part");
  boolean complete = false;
  try {
   MessageDigest digest = MessageDigest.getInstance("SHA-256");
   long bytes = 0;
   try (FileOutputStream output = new FileOutputStream(partial)) {
    byte[] buffer = new byte[32768]; int count;
    while ((count = input.read(buffer)) != -1) {
     if (Thread.currentThread().isInterrupted()) throw new InterruptedIOException("Download interrupted");
     bytes += count;
     if (bytes > MAX_BYTES) throw new IOException("APK too large");
     output.write(buffer, 0, count); digest.update(buffer, 0, count); progress.update(bytes, expectedLength);
    }
    output.getFD().sync();
   }
   if (bytes == 0 || (expectedLength >= 0 && bytes != expectedLength) || !expectedHash.equals(hex(digest.digest()))) throw new IOException("APK verification failed");
   if (destination.exists() && !destination.delete()) throw new IOException("Cannot replace previous download");
   if (!partial.renameTo(destination)) throw new IOException("Cannot finish download");
   complete = true; return destination;
  } finally { if (!complete) partial.delete(); }
 }
 public static boolean matches(File file, String expectedHash) throws Exception {
  if (!file.isFile() || file.length() == 0 || file.length() > MAX_BYTES || expectedHash == null) return false;
  MessageDigest digest = MessageDigest.getInstance("SHA-256");
  try (InputStream input = new FileInputStream(file)) { byte[] buffer = new byte[32768]; int count; while ((count = input.read(buffer)) != -1) digest.update(buffer, 0, count); }
  return expectedHash.equals(hex(digest.digest()));
 }
 public static boolean sameRelease(String expectedPackage, long expectedVersion, Set<String> expectedSigners, String actualPackage, long actualVersion, Set<String> actualSigners) {
  return expectedVersion > 0 && expectedVersion == actualVersion && expectedPackage.equals(actualPackage) && !expectedSigners.isEmpty() && expectedSigners.equals(actualSigners);
 }
 public static String hex(byte[] value) { StringBuilder result = new StringBuilder(); for (byte b : value) result.append(String.format(java.util.Locale.ROOT, "%02x", b & 255)); return result.toString(); }
}
