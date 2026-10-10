package nl.fieldday.app;
import android.app.Activity;
import android.os.Bundle;
import android.content.Intent;
import android.net.Uri;
import android.graphics.Color;
import android.view.View;
import android.webkit.*;
import android.widget.FrameLayout;
import java.io.*;
import java.util.*;
public class MainActivity extends Activity {
 private WebView web;
 private static final String HOST="appassets.androidplatform.net";
 @Override public void onCreate(Bundle saved){super.onCreate(saved);getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR|View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);FrameLayout root=new FrameLayout(this);root.setBackgroundColor(Color.rgb(247,245,236));root.setOnApplyWindowInsetsListener((v,insets)->{v.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());return insets.consumeSystemWindowInsets();});web=new WebView(this);web.setBackgroundColor(Color.rgb(247,245,236));root.addView(web,new FrameLayout.LayoutParams(-1,-1));setContentView(root);root.requestApplyInsets();WebSettings settings=web.getSettings();settings.setJavaScriptEnabled(true);settings.setDomStorageEnabled(true);settings.setAllowFileAccess(false);settings.setAllowContentAccess(false);settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);settings.setUserAgentString(settings.getUserAgentString()+" FielddayAndroid/1.0");web.setWebViewClient(new WebViewClient(){@Override public WebResourceResponse shouldInterceptRequest(WebView v,WebResourceRequest request){Uri u=request.getUrl();if(!HOST.equals(u.getHost()))return null;try{String path=u.getPath();if(path==null||!path.startsWith("/assets/")||path.contains(".."))throw new IOException();String name=path.substring(8);String mime=name.endsWith(".html")?"text/html":name.endsWith(".css")?"text/css":(name.endsWith(".js")||name.endsWith(".mjs"))?"application/javascript":name.endsWith(".json")?"application/json":name.endsWith(".svg")?"image/svg+xml":name.endsWith(".png")?"image/png":"application/octet-stream";return new WebResourceResponse(mime,"UTF-8",getAssets().open(name));}catch(IOException e){return new WebResourceResponse("text/plain","UTF-8",404,"Not found",Collections.emptyMap(),new ByteArrayInputStream(new byte[0]));}}@Override public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest request){Uri u=request.getUrl();if("https".equals(u.getScheme())&&HOST.equals(u.getHost())&&u.getPath().startsWith("/assets/"))return false;if("https".equals(u.getScheme())||"mailto".equals(u.getScheme())){try{startActivity(new Intent(Intent.ACTION_VIEW,u));}catch(Exception ignored){}}return true;}});if(android.os.Build.VERSION.SDK_INT>=33)getOnBackInvokedDispatcher().registerOnBackInvokedCallback(android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT,()->goBack());web.loadUrl("https://"+HOST+"/assets/index.html");}
 @Override public void onBackPressed(){goBack();}
 private void goBack(){web.evaluateJavascript("window.fielddayBack ? window.fielddayBack() : false",value->{if(!"true".equals(value))finish();});}
 @Override protected void onDestroy(){if(web!=null)web.destroy();super.onDestroy();}
}
