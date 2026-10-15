package io.studentos.shortcuts;
import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;

public final class RouteActivity extends Activity {
    @Override public void onCreate(Bundle saved) {
        super.onCreate(saved);
        String route = Routes.safe(getIntent().getStringExtra("route"));
        if ("assistant".equals(route) || "quick".equals(route)) startActivity(new Intent(this,AssistActivity.class).putExtra("route",route));
        else Routes.open(this,route,null);
        finish();
    }
}
