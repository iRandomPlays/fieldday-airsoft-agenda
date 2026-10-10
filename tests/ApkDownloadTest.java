import nl.fieldday.app.ApkDownload;
import java.io.*;
import java.nio.file.Files;
import java.security.MessageDigest;
import java.util.*;
public class ApkDownloadTest {
 public static void main(String[] args) throws Exception {
  File folder = new File(args[0]); File target = new File(folder, "release.apk");
  byte[] data = "fixture APK contents".getBytes("UTF-8"); String hash = ApkDownload.hex(MessageDigest.getInstance("SHA-256").digest(data));
  final long[] progress = {0};
  ApkDownload.copyVerified(new ByteArrayInputStream(data),target,hash,data.length,(bytes,total)->progress[0]=bytes);
  if(!ApkDownload.matches(target,hash)||progress[0]!=data.length)throw new AssertionError("Valid download failed");
  reject(new ByteArrayInputStream(data),target,"0".repeat(64),data.length);
  if(!ApkDownload.matches(target,hash))throw new AssertionError("Failed download replaced verified file");
  reject(new ByteArrayInputStream(data),target,hash,data.length+1);
  reject(new ByteArrayInputStream(new byte[0]),target,hash,0);
  reject(new ByteArrayInputStream(data),target,hash,ApkDownload.MAX_BYTES+1);
  reject(new InputStream(){int n;public int read()throws IOException{if(n++>4)throw new IOException("Network interrupted");return 1;}},target,hash,-1);
  ApkDownload.copyVerified(new ByteArrayInputStream(data),target,hash,-1,(bytes,total)->{});
  Thread.currentThread().interrupt();reject(new ByteArrayInputStream(data),target,hash,data.length);Thread.interrupted();
  if(new File(folder,"release.apk.part").exists())throw new AssertionError("Partial APK left behind");
  if(!ApkDownload.sameRelease("nl.fieldday.app",9,Set.of("signer"),"nl.fieldday.app",9,Set.of("signer")))throw new AssertionError("Matching release rejected");
  if(ApkDownload.sameRelease("nl.fieldday.app",9,Set.of("signer"),"wrong.app",9,Set.of("signer"))||ApkDownload.sameRelease("nl.fieldday.app",9,Set.of("signer"),"nl.fieldday.app",8,Set.of("signer"))||ApkDownload.sameRelease("nl.fieldday.app",9,Set.of("signer"),"nl.fieldday.app",9,Set.of("wrong"))||ApkDownload.sameRelease("nl.fieldday.app",9,Set.of(),"nl.fieldday.app",9,Set.of()))throw new AssertionError("Unsafe release accepted");
  System.out.println("APK download- en identiteitscontroles geslaagd");
 }
 private static void reject(InputStream stream,File target,String hash,long length)throws Exception {
  try {ApkDownload.copyVerified(stream,target,hash,length,(bytes,total)->{});throw new AssertionError("Unsafe download accepted");}catch(IOException expected){}
 }
}
