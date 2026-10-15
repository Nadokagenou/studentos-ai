package io.studentos.shortcuts;

import android.app.Activity;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.view.View;
import android.view.WindowInsets;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

final class Ui {
    static int dp(Activity a, int value) { return (int)(a.getResources().getDisplayMetrics().density * value + .5f); }
    static LinearLayout page(Activity a) {
        ScrollView scroller = new ScrollView(a);
        scroller.setFillViewport(true);
        LinearLayout body = new LinearLayout(a);
        body.setOrientation(LinearLayout.VERTICAL);
        int padding = dp(a, 24);
        body.setPadding(padding, padding, padding, padding);
        body.setBackgroundColor(Color.rgb(247,250,248));
        scroller.addView(body);
        scroller.setOnApplyWindowInsetsListener((v, insets) -> {
            int top = insets.getSystemWindowInsetTop();
            int bottom = insets.getSystemWindowInsetBottom();
            body.setPadding(padding, padding + top, padding, padding + bottom);
            return insets;
        });
        a.setContentView(scroller);
        return body;
    }
    static TextView text(Activity a, LinearLayout body, String text, int size) {
        TextView view = new TextView(a); view.setText(text); view.setTextSize(size);
        view.setTextColor(Color.rgb(27,46,42)); view.setPadding(0,dp(a,8),0,dp(a,8));
        body.addView(view); return view;
    }
    static Button button(Activity a, LinearLayout body, String title, View.OnClickListener action) {
        Button button = new Button(a); button.setText(title); button.setAllCaps(false);
        button.setTextColor(Color.WHITE); button.setTextSize(16);
        GradientDrawable background = new GradientDrawable(); background.setColor(Color.rgb(23,111,99)); background.setCornerRadius(dp(a,16));
        button.setBackground(background); button.setMinHeight(dp(a,52));
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(-1,-2); params.topMargin=dp(a,10);
        body.addView(button,params); button.setOnClickListener(action); return button;
    }
}
