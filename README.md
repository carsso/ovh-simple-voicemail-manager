OVH Simple Voicemail Manager
============================

This project is a simple OVH voicemail manager to manage your messages and listen your records.

_Depends on my project OVH API HTTP wrapper written in PHP : https://github.com/carsso/ovh-api-simple-http-wrapper_


Screenshots:

Lines view:
![Lines view](https://user-images.githubusercontent.com/666182/36616603-aaf32398-18e4-11e8-8132-d4a52221c583.png)

Messages view:
![Messages view](https://user-images.githubusercontent.com/666182/36616602-aaa990d4-18e4-11e8-8a2b-0eef3d51b337.png)


How to use
----------

Install the HTTP wrapper dependency : `git submodule init && git submodule update`

Copy the default htaccess file : `cp .htaccess-dist .htaccess`

Then, go to the ovhapi folder and follow the "How to use" section from https://github.com/carsso/ovh-api-simple-http-wrapper

/!\ Security warning /!\
------------------------

This project does not provide client-side authentication or restrictions of any kind.

This project is provided "as-is" and I decline any responsibility of any security issue with your OVH account if you choose to use it in an inappropriate/insecure way.

License
-------

BSD 3-clause "New" or "Revised" License


Note
----

This project is not affiliated with OVH.
