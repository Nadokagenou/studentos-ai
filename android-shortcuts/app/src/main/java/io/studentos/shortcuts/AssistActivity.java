package io.studentos.shortcuts;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.os.Bundle;
import android.speech.RecognizerIntent;
import android.text.InputFilter;
import android.view.Gravity;
import android.view.WindowManager;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.Toast;
import java.util.ArrayList;

/** ACTION_ASSIST opens a small bottom activity, not an always-on overlay or screen reader. */
public final class AssistActivity extends Activity {
    private EditText draft;
    private String route;
    @Override public void onCreate(Bundle saved) {
        super.onCreate(saved);
        route = "quick".equals(getIntent().getStringExtra("route")) ? "quick" : "assistant";
        LinearLayout body = Ui.page(this);
        Ui.text(this,body,"Student OS  ·  " + ("quick".equals(route) ? "เพิ่มงานด่วน" : "ผู้ช่วยนักเรียน"),22);
        Ui.text(this,body,"พิมพ์หรือพูดไว้ แล้วไปตรวจในแอป",15);
        draft = new EditText(this);
        draft.setHint("quick".equals(route) ? "รายงานชีวะ ส่งวันศุกร์" : "วันนี้ควรเริ่มงานไหนก่อน?");
        draft.setTextSize(18); draft.setMinLines(2); draft.setMaxLines(5);
        draft.setGravity(Gravity.TOP); draft.setFilters(new InputFilter[]{new InputFilter.LengthFilter("quick".equals(route) ? 500 : 2000)});
        draft.setInputType(android.text.InputType.TYPE_CLASS_TEXT | android.text.InputType.TYPE_TEXT_FLAG_MULTI_LINE | android.text.InputType.TYPE_TEXT_FLAG_CAP_SENTENCES);
        body.addView(draft,new LinearLayout.LayoutParams(-1,-2));
        if (saved != null) draft.setText(saved.getString("draft", ""));
        Ui.button(this,body,"พูดแทนพิมพ์",v -> voice());
        Ui.button(this,body,"ไปตรวจใน Student OS",v -> { if (Routes.open(this,route,draft.getText().toString())) finish(); });
        Ui.button(this,body,"เพิ่มงานด่วน",v -> { if (Routes.open(this,"quick",draft.getText().toString())) finish(); });
        Ui.button(this,body,"วันนี้ทำอะไร",v -> { if (Routes.open(this,"today",null)) finish(); });
        Ui.text(this,body,"เสียงใช้บริการรู้จำเสียงของเครื่องเมื่อคุณกดเท่านั้น อาจส่งเสียงไปผู้ให้บริการตามการตั้งค่าเครื่อง • ปิดแผงนี้แล้วกลับแอปเดิมได้",12);
        Ui.button(this,body,"ปิด",v -> finish());
        getWindow().setGravity(Gravity.BOTTOM);
        getWindow().setLayout(WindowManager.LayoutParams.MATCH_PARENT,WindowManager.LayoutParams.WRAP_CONTENT);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_DIM_BEHIND);
        WindowManager.LayoutParams params=getWindow().getAttributes(); params.dimAmount=.3f; getWindow().setAttributes(params);
        getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE | WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_HIDDEN);
        setFinishOnTouchOutside(true);
    }
    @Override protected void onSaveInstanceState(Bundle saved) {
        saved.putString("draft",draft.getText().toString());
        super.onSaveInstanceState(saved);
    }
    private void voice() {
        Intent speech = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        speech.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL,RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        speech.putExtra(RecognizerIntent.EXTRA_LANGUAGE,"th-TH");
        speech.putExtra(RecognizerIntent.EXTRA_PROMPT,"บอกงานหรือคำถามของคุณ");
        try { startActivityForResult(speech,20); }
        catch (ActivityNotFoundException ignored) { Toast.makeText(this,"เครื่องนี้ไม่มีบริการรู้จำเสียง ใช้การพิมพ์ได้ครับ",Toast.LENGTH_LONG).show(); }
    }
    @Override protected void onActivityResult(int request,int result,Intent data) {
        super.onActivityResult(request,result,data);
        if (request==20 && result==RESULT_OK && data!=null) {
            ArrayList<String> words=data.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);
            if (words!=null && !words.isEmpty()) { draft.setText(words.get(0)); draft.setSelection(draft.length()); }
        }
    }
}
