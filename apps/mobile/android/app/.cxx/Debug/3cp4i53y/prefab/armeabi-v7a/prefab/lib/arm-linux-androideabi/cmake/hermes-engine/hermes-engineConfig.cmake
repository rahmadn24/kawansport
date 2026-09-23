if(NOT TARGET hermes-engine::libhermes)
add_library(hermes-engine::libhermes SHARED IMPORTED)
set_target_properties(hermes-engine::libhermes PROPERTIES
    IMPORTED_LOCATION "/Users/macintoshhd/.gradle/caches/transforms-3/553c0bf9e65d01f43cba1297dd3f3985/transformed/hermes-android-0.73.11-debug/prefab/modules/libhermes/libs/android.armeabi-v7a/libhermes.so"
    INTERFACE_INCLUDE_DIRECTORIES "/Users/macintoshhd/.gradle/caches/transforms-3/553c0bf9e65d01f43cba1297dd3f3985/transformed/hermes-android-0.73.11-debug/prefab/modules/libhermes/include"
    INTERFACE_LINK_LIBRARIES ""
)
endif()

