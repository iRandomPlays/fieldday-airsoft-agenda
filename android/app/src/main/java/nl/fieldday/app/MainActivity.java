package nl.fieldday.app;
import android.app.Activity;
import android.os.Bundle;
import android.content.Intent;
import android.net.Uri;
import android.graphics.Color;
import android.view.View;
import android.webkit.*;
import android.widget.FrameLayout;
import org.json.JSONObject;
import java.io.*;
import java.util.*;
public class MainActivity extends Activity {
 private WebView web;
 private UpdateGate updates;
 private static final String HOST="appassets.androidplatform.net";
 @Override public void onCreate(Bundle saved){super.onCreate(saved);getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR|View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);FrameLayout root=new FrameLayout(this);root.setBackgroundColor(Color.rgb(247,245,236));root.setOnApplyWindowInsetsListener((v,insets)->{v.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());return insets.consumeSystemWindowInsets();});web=new WebView(this);web.setBackgroundColor(Color.rgb(247,245,236));root.addView(web,new FrameLayout.LayoutParams(-1,-1));setContentView(root);root.requestApplyInsets();updates=new UpdateGate(this,root,web);WebSettings settings=web.getSettings();settings.setJavaScriptEnabled(true);settings.setDomStorageEnabled(true);settings.setAllowFileAccess(false);settings.setAllowContentAccess(false);settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);settings.setUserAgentString(settings.getUserAgentString()+" FielddayAndroid/1.0");web.setWebViewClient(new WebViewClient(){@Override public void onPageFinished(WebView view,String url){syncUpdateTheme();}@Override public WebResourceResponse shouldInterceptRequest(WebView v,WebResourceRequest request){Uri u=request.getUrl();if(!HOST.equals(u.getHost()))return null;try{String path=u.getPath();if(path==null||!path.startsWith("/assets/")||path.contains(".."))throw new IOException();String name=path.substring(8);String mime=name.endsWith(".html")?"text/html":name.endsWith(".css")?"text/css":(name.endsWith(".js")||name.endsWith(".mjs"))?"application/javascript":name.endsWith(".json")?"application/json":name.endsWith(".svg")?"image/svg+xml":name.endsWith(".png")?"image/png":"application/octet-stream";return new WebResourceResponse(mime,"UTF-8",getAssets().open(name));}catch(IOException e){return new WebResourceResponse("text/plain","UTF-8",404,"Not found",Collections.emptyMap(),new ByteArrayInputStream(new byte[0]));}}@Override public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest request){Uri u=request.getUrl();if("https".equals(u.getScheme())&&HOST.equals(u.getHost())&&u.getPath().startsWith("/assets/"))return false;if("https".equals(u.getScheme())||"mailto".equals(u.getScheme())){try{startActivity(new Intent(Intent.ACTION_VIEW,u));}catch(Exception ignored){}}return true;}});if(android.os.Build.VERSION.SDK_INT>=33)getOnBackInvokedDispatcher().registerOnBackInvokedCallback(android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT,()->goBack());web.setWebChromeClient(new WebChromeClient(){@Override public boolean onJsPrompt(WebView view,String url,String message,String defaultValue,JsPromptResult result){if(!url.startsWith("https://"+HOST+"/assets/")||!("fieldday:share".equals(message)||"fieldday:whatsapp".equals(message)||"fieldday:copy".equals(message)||"fieldday:calendar".equals(message)))return false;try{JSONObject payload=new JSONObject(defaultValue);if("fieldday:calendar".equals(message)){insertCalendar(payload);result.confirm("ok");return true;}String text=payload.optString("text","");if(text.length()>100000)throw new IllegalArgumentException();if("fieldday:copy".equals(message)){android.content.ClipboardManager clipboard=(android.content.ClipboardManager)getSystemService(CLIPBOARD_SERVICE);clipboard.setPrimaryClip(android.content.ClipData.newPlainText("Fieldday",text));result.confirm("ok");return true;}Intent share=new Intent(Intent.ACTION_SEND);share.setType("text/plain");share.putExtra(Intent.EXTRA_TEXT,text);if("fieldday:whatsapp".equals(message)){share.setPackage("com.whatsapp");try{startActivity(share);}catch(android.content.ActivityNotFoundException e){share.setPackage(null);startActivity(Intent.createChooser(share,"Delen via"));}}else startActivity(Intent.createChooser(share,"Delen via"));result.confirm("ok");}catch(Exception e){result.cancel();}return true;}});String token=inviteFrom(getIntent());if(token.isEmpty())token=getSharedPreferences("fieldday-navigation",MODE_PRIVATE).getString("pendingInvite","");if(!token.matches("[a-f0-9]{64}"))token="";if(!token.isEmpty())rememberInvite(token);web.loadUrl("https://"+HOST+"/assets/index.html"+(token.isEmpty()?"":"#invite="+token));}
 private void insertCalendar(JSONObject payload) throws Exception {
  String title=payload.getString("title"),location=payload.optString("location",""),description=payload.optString("description","");
  long begin=payload.getLong("start"),end=payload.getLong("end");
  if(title.isEmpty()||title.length()>1000||location.length()>2000||description.length()>10000||begin<=0||end<=begin||end-begin>366L*86400000L)throw new IllegalArgumentException();
  String note=payload.optString("note","");if(!note.isEmpty())android.widget.Toast.makeText(this,note,android.widget.Toast.LENGTH_LONG).show();
  Intent calendar=new Intent(Intent.ACTION_INSERT,android.provider.CalendarContract.Events.CONTENT_URI);
  calendar.putExtra(android.provider.CalendarContract.Events.TITLE,title);
  calendar.putExtra(android.provider.CalendarContract.Events.EVENT_LOCATION,location);
  calendar.putExtra(android.provider.CalendarContract.Events.DESCRIPTION,description);
  calendar.putExtra(android.provider.CalendarContract.EXTRA_EVENT_BEGIN_TIME,begin);
  calendar.putExtra(android.provider.CalendarContract.EXTRA_EVENT_END_TIME,end);
  calendar.putExtra(android.provider.CalendarContract.EXTRA_EVENT_ALL_DAY,payload.optBoolean("allDay",false));
  try{startActivity(calendar);}catch(android.content.ActivityNotFoundException unavailable){
   android.widget.Toast.makeText(this,"Geen agenda-app gevonden. Google Agenda wordt geopend.",android.widget.Toast.LENGTH_LONG).show();
   boolean allDay=payload.optBoolean("allDay",false);java.text.SimpleDateFormat fmt=new java.text.SimpleDateFormat(allDay?"yyyyMMdd":"yyyyMMdd'T'HHmmss'Z'",java.util.Locale.ROOT);fmt.setTimeZone(java.util.TimeZone.getTimeZone("UTC"));
   Uri url=Uri.parse("https://calendar.google.com/calendar/render").buildUpon().appendQueryParameter("action","TEMPLATE").appendQueryParameter("text",title).appendQueryParameter("dates",fmt.format(new Date(begin))+"/"+fmt.format(new Date(end))).appendQueryParameter("details",description).appendQueryParameter("location",location).appendQueryParameter("ctz","Europe/Amsterdam").build();
   startActivity(new Intent(Intent.ACTION_VIEW,url));
  }
 }
 @Override public void onBackPressed(){goBack();}
 private void goBack(){if(updates!=null&&updates.isBlocking()){finish();return;}web.evaluateJavascript("window.fielddayBack ? window.fielddayBack() : false",value->{if(!"true".equals(value))finish();});}
 private String inviteFrom(Intent intent){if(intent==null)return "";Uri u=intent.getData();if(u==null)return "";boolean legacy="fieldday".equals(u.getScheme())&&"invite".equals(u.getHost());boolean verified="https".equals(u.getScheme())&&"fieldday-airsoft-irandomplays.web.app".equals(u.getHost())&&u.getPath()!=null&&u.getPath().matches("/invite/[a-f0-9]{64}");if(!legacy&&!verified)return "";String token=u.getLastPathSegment();return token!=null&&token.matches("[a-f0-9]{64}")?token:"";}
 @Override protected void onNewIntent(Intent intent){super.onNewIntent(intent);setIntent(intent);String token=inviteFrom(intent);if(!token.isEmpty()){rememberInvite(token);web.loadUrl("https://"+HOST+"/assets/index.html#invite="+token);}}
 private void rememberInvite(String token){getSharedPreferences("fieldday-navigation",MODE_PRIVATE).edit().putString("pendingInvite",token).apply();}
 private void syncUpdateTheme(){if(web!=null&&updates!=null)web.evaluateJavascript("document.body.classList.contains('dark')",value->{if(updates!=null)updates.setDark("true".equals(value));});}
 @Override protected void onPause(){syncUpdateTheme();super.onPause();}
 @Override protected void onResume(){super.onResume();if(updates!=null)updates.resume();}
 @Override protected void onDestroy(){if(updates!=null)updates.destroy();if(web!=null)web.destroy();super.onDestroy();}
}
