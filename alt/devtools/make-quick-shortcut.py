# สร้างไฟล์คำสั่งลัด "เพิ่มงาน" สำหรับ iPhone (alt/quick-add.shortcut) — ไม่ถูกโหลดโดยแอป
# ------------------------------------------------------------
# คำสั่งลัด 3 ขั้น: ถามหาข้อมูลเข้า → POST {"text": …} ไปที่ลิงก์ quick-add → แจ้งเตือนข้อความที่ตอบกลับ
# ลิงก์ของแต่ละคนไม่ฝังในไฟล์ — ถามตอนติดตั้ง (WFWorkflowImportQuestions) ผู้ใช้วางลิงก์ที่แอปคัดลอกให้
#
# iOS ติดตั้งได้เฉพาะไฟล์ที่เซ็นแล้ว และเซ็นได้บน Mac เท่านั้น:
#   python3 make-quick-shortcut.py
#   shortcuts sign --mode anyone --input quick.shortcut --output ../quick-add.shortcut
#   cp ../quick-add.shortcut ../../quick-add.shortcut     (หน้าหลักใช้ไฟล์เดียวกัน)
import plistlib, uuid
A, B, C = (str(uuid.uuid4()).upper() for _ in range(3))
OBJ = '￼'
def tok(out_uuid, name):
    return {'Value': {'string': OBJ, 'attachmentsByRange': {'{0, 1}': {'OutputUUID': out_uuid, 'OutputName': name, 'Type': 'ActionOutput'}}},
            'WFSerializationType': 'WFTextTokenString'}
wf = {
  'WFWorkflowClientVersion': '2607.0.2',
  'WFWorkflowMinimumClientVersion': 900,
  'WFWorkflowMinimumClientVersionString': '900',
  'WFWorkflowIcon': {'WFWorkflowIconStartColor': 2071128575, 'WFWorkflowIconGlyphNumber': 59446},
  'WFWorkflowTypes': [],
  'WFWorkflowInputContentItemClasses': [],
  'WFWorkflowHasOutputFallback': False,
  'WFWorkflowHasShortcutInputVariables': False,
  'WFQuickActionSurfaces': [],
  'WFWorkflowImportQuestions': [{
    'ActionIndex': 1, 'Category': 'Parameter', 'ParameterKey': 'WFURL', 'DefaultValue': '',
    'Text': 'วางลิงก์ที่คัดลอกจากแอป Student OS',
  }],
  'WFWorkflowActions': [
    {'WFWorkflowActionIdentifier': 'is.workflow.actions.ask',
     'WFWorkflowActionParameters': {'UUID': A, 'WFAskActionPrompt': 'เพิ่มงาน', 'WFInputType': 'Text'}},
    {'WFWorkflowActionIdentifier': 'is.workflow.actions.downloadurl',
     'WFWorkflowActionParameters': {'UUID': B, 'WFURL': '', 'WFHTTPMethod': 'POST', 'WFHTTPBodyType': 'JSON', 'ShowHeaders': False,
       'WFJSONValues': {'Value': {'WFDictionaryFieldValueItems': [{
           'WFItemType': 0,
           'WFKey': {'Value': {'string': 'text'}, 'WFSerializationType': 'WFTextTokenString'},
           'WFValue': tok(A, 'Provided Input')}]},
         'WFSerializationType': 'WFDictionaryFieldValue'}}},
    {'WFWorkflowActionIdentifier': 'is.workflow.actions.notification',
     'WFWorkflowActionParameters': {'UUID': C, 'WFNotificationActionTitle': 'Student OS',
       'WFNotificationActionBody': tok(B, 'Contents of URL'), 'WFNotificationActionSound': False}},
  ],
}
plistlib.dump(wf, open('quick.shortcut', 'wb'), fmt=plistlib.FMT_BINARY)
print('ok')
