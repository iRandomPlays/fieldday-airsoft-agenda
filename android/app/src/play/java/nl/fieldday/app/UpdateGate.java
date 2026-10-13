package nl.fieldday.app;

import android.app.Activity;
import android.content.Intent;
import android.content.res.ColorStateList;
import android.graphics.Color;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import com.google.android.play.core.appupdate.AppUpdateInfo;
import com.google.android.play.core.appupdate.AppUpdateManager;
import com.google.android.play.core.appupdate.AppUpdateManagerFactory;
import com.google.android.play.core.appupdate.AppUpdateOptions;
import com.google.android.play.core.install.model.AppUpdateType;
import com.google.android.play.core.install.model.UpdateAvailability;

/** Google Play only: no APK downloads, installer permissions or GitHub version gate. */
final class UpdateGate {
 private final Activity activity;
 private final View app;
 private final ScrollView overlay;
 private final LinearLayout content;
 private final AppUpdateManager manager;
 private final Handler handler = new Handler(Looper.getMainLooper());
 private boolean blocked=true, checking=false, destroyed=false, dark=false, flowRunning=false;
 private int generation=0;
 private String heading="Updates controleren", message="Even controleren op updates via Google Play…";
 private boolean retry=true;

 UpdateGate(Activity activity, FrameLayout root, View app) {
  this.activity=activity; this.app=app;
  manager=AppUpdateManagerFactory.create(activity);
  overlay=new ScrollView(activity); overlay.setFillViewport(true);
  content=new LinearLayout(activity); content.setOrientation(LinearLayout.VERTICAL);
  content.setGravity(Gravity.CENTER_VERTICAL); content.setPadding(dp(28),dp(32),dp(28),dp(32));
  overlay.addView(content,new ScrollView.LayoutParams(-1,-1));
  root.addView(overlay,new FrameLayout.LayoutParams(-1,-1));
  app.setVisibility(View.GONE); render();
 }
 boolean isBlocking(){return blocked;}
 void resume(){if(!destroyed){flowRunning=false;check(false);}}
 private void check(boolean requested){
  if(destroyed||checking)return;
  checking=true; final int run=++generation;
  if(blocked)show("Updates controleren","Even controleren op updates via Google Play…",false);
  handler.postDelayed(()->{if(!destroyed&&checking&&generation==run){generation++;checking=false;failed();}},15000);
  manager.getAppUpdateInfo().addOnSuccessListener(info->{
   if(destroyed||generation!=run)return;
   checking=false;
   int availability=info.updateAvailability();
   if(availability==UpdateAvailability.UPDATE_NOT_AVAILABLE){
    blocked=false;overlay.setVisibility(View.GONE);app.setVisibility(View.VISIBLE);
    activity.getSharedPreferences("fieldday-navigation",Activity.MODE_PRIVATE).edit().remove("pendingInvite").apply();
   }else if(availability==UpdateAvailability.UPDATE_AVAILABLE||availability==UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS){
    blocked=true;app.setVisibility(View.GONE);overlay.setVisibility(View.VISIBLE);
    show("Update verplicht","Er staat een update van Fieldday klaar in Google Play. Installeer deze om verder te gaan. Je account en gegevens blijven behouden.",true);
    if(info.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE)&&(requested||availability==UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS))launch(info);
   }else failed();
  }).addOnFailureListener(error->{if(destroyed||generation!=run)return;checking=false;failed();});
 }
 private void launch(AppUpdateInfo info){
  if(destroyed||flowRunning)return;
  try{flowRunning=manager.startUpdateFlowForResult(info,activity,AppUpdateOptions.newBuilder(AppUpdateType.IMMEDIATE).build(),7001);
   if(!flowRunning)failed();
  }catch(Exception error){flowRunning=false;failed();}
 }
 private void failed(){
  if(blocked)show("Controle niet gelukt","Google Play kon niet controleren op updates. Controleer je verbinding en probeer opnieuw. Gebruik de versie die via Google Play is geïnstalleerd.",true);
  // A temporary failure after a successful check does not erase the usable session.
 }
 private void show(String title,String body,boolean buttons){heading=title;message=body;retry=buttons;render();}
 private void render(){
  if(destroyed)return;
  int ink=dark?Color.rgb(237,242,232):Color.rgb(19,43,44);
  overlay.setBackgroundColor(dark?Color.rgb(23,39,39):Color.rgb(247,245,236));content.removeAllViews();
  TextView brand=text("FIELDDAY",18,ink);brand.setTypeface(Typeface.DEFAULT,Typeface.BOLD);content.addView(brand);
  TextView title=text(heading,28,ink);title.setTypeface(Typeface.DEFAULT,Typeface.BOLD);title.setPadding(0,dp(24),0,dp(12));content.addView(title);
  content.addView(text(message,16,ink));
  if(retry){button("Controleren en bijwerken",()->check(true));button("Open Google Play",()->{
   try{activity.startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse("market://details?id="+activity.getPackageName())).setPackage("com.android.vending"));}
   catch(Exception absent){try{activity.startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse("https://play.google.com/store/apps/details?id="+activity.getPackageName())));}catch(Exception ignored){}}
  });}
 }
 private TextView text(String value,int size,int color){TextView v=new TextView(activity);v.setText(value);v.setTextSize(size);v.setTextColor(color);return v;}
 private void button(String title,Runnable action){Button b=new Button(activity);b.setText(title);b.setAllCaps(false);b.setTextColor(Color.WHITE);b.setBackgroundTintList(ColorStateList.valueOf(Color.rgb(7,89,88)));LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,-2);p.topMargin=dp(16);b.setMinHeight(dp(48));content.addView(b,p);b.setOnClickListener(v->action.run());}
 private int dp(int value){return Math.round(value*activity.getResources().getDisplayMetrics().density);}
 void setDark(boolean value){if(dark!=value){dark=value;if(blocked)render();}}
 void destroy(){destroyed=true;generation++;handler.removeCallbacksAndMessages(null);}
}
