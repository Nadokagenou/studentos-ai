package io.studentos.shortcuts;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.widget.Toast;

/** External browser shares its existing Student OS session; never embed another wallet. */
final class Routes {
    static final String BASE = "https://nadokagenou.github.io/studentos-ai/";
    static String safe(String route) {
        return "quick".equals(route) || "assistant".equals(route) || "tasks".equals(route) || "today".equals(route) ? route : "today";
    }
    static boolean open(Activity activity, String route, String draft) {
        route = safe(route);
        Uri.Builder url = Uri.parse(BASE).buildUpon().appendQueryParameter("go", route);
        if (draft != null && !draft.trim().isEmpty() && ("quick".equals(route) || "assistant".equals(route))) {
            int limit = "quick".equals(route) ? 500 : 2000;
            url.encodedFragment("sos-draft=" + Uri.encode(draft.substring(0, Math.min(draft.length(), limit))));
        }
        Intent intent = new Intent(Intent.ACTION_VIEW, url.build()).addCategory(Intent.CATEGORY_BROWSABLE);
        try { activity.startActivity(intent); return true; }
        catch (ActivityNotFoundException exception) { Toast.makeText(activity, "ไม่พบเบราว์เซอร์สำหรับเปิด Student OS", Toast.LENGTH_LONG).show(); return false; }
    }
}
