package nl.fieldday.app;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;
import java.io.File;
import java.io.FileNotFoundException;

/** Exposes one private APK, read-only, using a temporary Android URI grant. */
public final class UpdateApkProvider extends ContentProvider {
 static File file(Context context) { return new File(new File(context.getFilesDir(), "updates"), "release.apk"); }
 static Uri uri(Context context) { return Uri.parse("content://" + context.getPackageName() + ".updates/release.apk"); }
 private void validate(Uri uri) {
  if (!"content".equals(uri.getScheme()) || !(getContext().getPackageName() + ".updates").equals(uri.getAuthority()) || !"/release.apk".equals(uri.getPath())) throw new SecurityException("Only the update APK is available");
 }
 @Override public boolean onCreate() { return true; }
 @Override public String getType(Uri uri) { validate(uri); return "application/vnd.android.package-archive"; }
 @Override public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
  validate(uri); if (!"r".equals(mode) || !file(getContext()).isFile()) throw new FileNotFoundException("Read-only update APK");
  return ParcelFileDescriptor.open(file(getContext()), ParcelFileDescriptor.MODE_READ_ONLY);
 }
 @Override public Cursor query(Uri uri, String[] projection, String selection, String[] selectionArgs, String sortOrder) {
  validate(uri); File apk = file(getContext()); if (!apk.isFile()) return null;
  String[] columns = projection == null ? new String[]{OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE} : projection;
  MatrixCursor cursor = new MatrixCursor(columns, 1); Object[] values = new Object[columns.length];
  for (int i = 0; i < columns.length; i++) { if (OpenableColumns.DISPLAY_NAME.equals(columns[i])) values[i] = "Fieldday-update.apk"; else if (OpenableColumns.SIZE.equals(columns[i])) values[i] = apk.length(); }
  cursor.addRow(values); return cursor;
 }
 @Override public Uri insert(Uri uri, ContentValues values) { throw new UnsupportedOperationException("Read only"); }
 @Override public int delete(Uri uri, String selection, String[] args) { throw new UnsupportedOperationException("Read only"); }
 @Override public int update(Uri uri, ContentValues values, String selection, String[] args) { throw new UnsupportedOperationException("Read only"); }
}
