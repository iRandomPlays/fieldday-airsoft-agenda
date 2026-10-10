import nl.fieldday.app.UpdatePolicy;
public class UpdatePolicyTest {
 public static void main(String[] args) {
  check(true, 6, 6, 0, true);
  check(false, 5, 6, 0, true);
  check(false, 6, 6, 7, true);
  check(false, 6, 6, 6, false);
  check(false, 6, 0, 0, false);
  check(false, 0, 6, 0, true);
  check(false, 6, 0, 0, true);
  check(true, 7, 6, 7, true);
  System.out.println("8 updatecontroles geslaagd");
 }
 private static void check(boolean expected,long installed,long remote,long cached,boolean checked) {
  if(UpdatePolicy.canOpen(installed,remote,cached,checked)!=expected)throw new AssertionError("Updatebeleid onjuist");
 }
}
