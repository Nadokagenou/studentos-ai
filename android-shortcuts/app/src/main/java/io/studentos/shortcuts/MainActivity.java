package io.studentos.shortcuts;

import android.app.Activity;
import android.app.StatusBarManager;
import android.app.role.RoleManager;
import android.content.ActivityNotFoundException;
import android.content.ComponentName;
import android.content.Intent;
import android.graphics.drawable.Icon;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.widget.LinearLayout;
import android.widget.Toast;

public final class MainActivity extends Activity {
    @Override public void onCreate(Bundle saved) {
        super.onCreate(saved);
        android.net.Uri target = getIntent().getData();
        if (target == null || !"studentos".equals(target.getScheme()) || !"setup".equals(target.getHost())) {
            if (Routes.open(this,"today",null)) finish();
            return;
        }
        LinearLayout body = Ui.page(this);
        Ui.text(this, body, "Student OS\nทางลัด Android", 28);
        Ui.text(this, body, "รุ่นทดลอง • เปิดเว็บหลักด้วยเบราว์เซอร์ที่คุณใช้อยู่", 15);
        Ui.button(this, body, "ลองแผงผู้ช่วย", v -> startActivity(new Intent(this, AssistActivity.class)));
        Ui.text(this, body, "1 · ปุ่มข้าง Wi‑Fi", 22);
        Ui.text(this, body, "เพิ่มปุ่ม “เพิ่มงาน Student OS” เพื่อพิมพ์งานได้ทันที แล้วตรวจและยืนยันในเว็บก่อนบันทึก", 16);
        Ui.button(this, body, "เพิ่มปุ่มในแผงด่วน", v -> addTile());
        Ui.text(this, body, "2 · เรียกเป็นผู้ช่วย", 22);
        Ui.text(this, body, "เลือก Student OS เป็นผู้ช่วยเริ่มต้นแทนตัวเดิม แล้วเรียกด้วยท่าทางของเครื่อง ปุ่มเปิดหน้านี้ให้คุณเลือกเอง ย้อนกลับไปเลือกผู้ช่วยเดิมได้ทุกเมื่อ", 16);
        Ui.button(this, body, "เลือกแอปผู้ช่วย", v -> chooseAssistant());
        Ui.text(this, body, "3 · กดไอคอนค้าง", 22);
        Ui.text(this, body, "กลับหน้าจอหลัก กดไอคอน “Student OS ทางลัด” ค้าง เลือกเพิ่มงาน ถามผู้ช่วย งานของฉัน หรือวันนี้ทำอะไร เมนูขึ้นอยู่กับ launcher ของเครื่อง", 16);
        Ui.button(this, body, "เปิดวันนี้ใน Student OS", v -> Routes.open(this,"today",null));
        Ui.text(this, body, "แอปนี้ไม่มีฐานข้อมูลแยก ไม่อ่านหน้าจอแอปอื่น ไม่ฟังเสียงตลอดเวลา และยังไม่ได้ติดตั้งปุ่มให้เอง การพิมพ์หรือพูดเป็นร่าง ต้องยืนยันในเว็บอีกครั้ง", 14);
    }
    private void addTile() {
        if (Build.VERSION.SDK_INT >= 33) {
            StatusBarManager manager = getSystemService(StatusBarManager.class);
            if (manager != null) {
                try {
                    manager.requestAddTileService(new ComponentName(this, QuickTileService.class), "เพิ่มงาน Student OS", Icon.createWithResource(this,R.drawable.ic_add), getMainExecutor(), result -> {
                        String message = result == StatusBarManager.TILE_ADD_REQUEST_RESULT_TILE_ADDED ? "เพิ่มปุ่มแล้ว ลากแผง Wi‑Fi ลงเพื่อทดลอง" : result == StatusBarManager.TILE_ADD_REQUEST_RESULT_TILE_ALREADY_ADDED ? "มีปุ่มนี้อยู่แล้วในแผงด่วน" : "ยังไม่ได้เพิ่มปุ่ม ลองแก้ไขแผงด่วนแล้วลากปุ่มเข้ามา";
                        Toast.makeText(this,message,Toast.LENGTH_LONG).show();
                    }); return;
                } catch (RuntimeException ignored) { /* OEM fallback below. */ }
            }
        }
        Toast.makeText(this,"ลากแผง Wi‑Fi ลง → แก้ไข → ลาก “เพิ่มงาน Student OS” เข้ามา",Toast.LENGTH_LONG).show();
    }
    private void chooseAssistant() {
        try {
            if (Build.VERSION.SDK_INT >= 29) {
                RoleManager roles = getSystemService(RoleManager.class);
                if (roles != null && roles.isRoleAvailable(RoleManager.ROLE_ASSISTANT) && !roles.isRoleHeld(RoleManager.ROLE_ASSISTANT)) {
                    startActivityForResult(roles.createRequestRoleIntent(RoleManager.ROLE_ASSISTANT),10); return;
                }
            }
            startActivity(new Intent(Settings.ACTION_VOICE_INPUT_SETTINGS));
        } catch (ActivityNotFoundException ignored) {
            try { startActivity(new Intent(Settings.ACTION_MANAGE_DEFAULT_APPS_SETTINGS)); }
            catch (ActivityNotFoundException unavailable) { Toast.makeText(this,"เปิดการตั้งค่าเครื่อง → แอปเริ่มต้น → แอปผู้ช่วย",Toast.LENGTH_LONG).show(); }
        }
    }
}
